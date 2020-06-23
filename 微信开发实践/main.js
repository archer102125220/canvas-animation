'use strict'
const Koa = require('koa')
const Router = require('koa-router')
const send = require('koa-send')
const crypto = require('crypto')
const fs = require('fs')
const https = require('https')

const APP_ID = '申请的测试号appid'
const APP_SECRET = '申请的测试号secret'
const TOKEN = '申请的测试号token（随便取，对上就行）'

const app = new Koa()

const prefix = '/wechat'
const reg = new RegExp('^\/wechat\/(.*)$')
const root = __dirname + '/public'

const router = new Router({ prefix })

/**
 * 用来绑定测试号
 * 加密/校验流程如下：
 * 1）将token、timestamp、nonce三个参数进行字典序排序
 * 2）将三个参数字符串拼接成一个字符串进行sha1加密
 * 3）开发者获得加密后的字符串可与signature对比，标识该请求来源于微信
 */
router.get('/verify', async (ctx) => {
  const timestamp = ctx.query.timestamp
  const nonce = ctx.query.nonce
  const shasum = crypto.createHash('sha1')
  shasum.update([TOKEN, timestamp, nonce].sort().join(''))
  const generatedSignature = shasum.digest('hex')
  if (generatedSignature === ctx.query.signature) {  // 来自微信服务器
    ctx.body = ctx.query.echostr
  }
  else {
    ctx.body = 'fail'
  }
})

/**
 * 页面获取微信配置
 */
router.get('/get_config', async (ctx) => {
  const url = ctx.query.url
  // 获取jsapi_ticket
  const accessToken = await getApiAccessToken()
  const ticket = await getTicket(accessToken)
  // 生成签名
  const timestamp = Date.now()  // 时间戳
  const nonceStr = Math.random().toString(36).substr(2, 15)  // 随机字符串

  const tempString = 'jsapi_ticket=' + ticket + '&noncestr=' + nonceStr + '&timestamp=' + timestamp + '&url=' + url
  const shasum = crypto.createHash('sha1')
  shasum.update(tempString)
  const signature = shasum.digest('hex')
  ctx.body = {
    appId: APP_ID,
    timestamp: timestamp,
    nonceStr: nonceStr,
    signature: signature
  }
})

/**
 * 拉取微信授权页
 */
router.get('/authorize', async (ctx) => {
  const callbackUrl = encodeURIComponent('https://omgfaq.com/wechat/get_user_openid')
  ctx.redirect(`https://open.weixin.qq.com/connect/oauth2/authorize?appid=${APP_ID}&redirect_uri=${callbackUrl}&response_type=code&scope=snsapi_userinfo&state=STATE#wechat_redirect`)
})

/**
 * 获取用户openid（微信回调地址）
 */
router.get('/get_user_openid', async (ctx) => {
  const code = ctx.query.code
  log2file(`code:${code}`)
  const openId = await getUserOpenId(code)
  log2file(`openId:${openId}`)
  // 用户openid获取成功写入cookie，重定向到首页
  ctx.cookies.set('openid', openId, {
    path: '/',
    httpOnly: false,
    expires: new Date('2222-12-12')
  })
  ctx.redirect('/wechat/index.html')
})

/**
 * 校验用户accessToken是否失效
 */
router.get('/check_user_access_token', async (ctx) => {
  const openId = ctx.cookies.get('openid', { path: '/' })
  const res = await checkPageAccessToken(openId)
  ctx.body = res
})

/**
 * 根据cookie里的openid获取用户信息
 */
router.get('/get_user_info', async (ctx) => {
  const openId = ctx.cookies.get('openid', { path: '/' })
  const accessToken = openId2accessToken[openId]
  let userInfo = null
  // 检测授权凭证是否失效
  const res = await checkPageAccessToken(openId)
  if (res.errcode !== 0) {
    log2file(`page access token invalidate:${openId}, ${accessToken}`)
    await refreshPageAccessToken()
  }
  userInfo = await getUserInfo(openId, accessToken)
  ctx.body = userInfo
})

app.use(router.routes()).use(router.allowedMethods())
app.use(async (ctx) => {
  await send(ctx, ctx.path.replace(reg, '/$1'), { root })
})

// openid和授权凭证/刷新token的映射，代替数据库
const openId2accessToken = {}
const openId2refreshToken = {}

/**
 * 根据授权回调code获取用户授权凭证access_token和用户openID
 * @returns {Promise}
 */
function getUserOpenId (code) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.weixin.qq.com/sns/oauth2/access_token?appid=${APP_ID}&secret=${APP_SECRET}&code=${code}&grant_type=authorization_code`, function (req, res) {
      let jsonStr = ''
      req.on('data', function (data) {
        jsonStr += data
      })
      req.on('end', function () {
        log2file(`getUserOpenId:${jsonStr}`)
        const res = JSON.parse(jsonStr)
        const openId = res.openid
        const pageAccessToken = res.access_token
        if (openId && pageAccessToken) {
          // TODO 超时后刷新token
          // setTimeout(() => {
          //     refreshPageToken()
          // }, res.expires_in)
          log2file(`getUserOpenId:${JSON.stringify(res)}`)
          openId2accessToken[openId] = pageAccessToken
          openId2refreshToken[openId] = res.refresh_token
          resolve(openId)
        }
        else {
          reject(`openId or accessToken empty:${openId},${pageAccessToken}`)
        }
      })
    })
  })
}

/**
 * 获取网页授权凭证access_token和用户openID
 * @returns {Promise}
 */
function getUserInfo (openId, accessToken) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openId}&lang=zh_CN`, function (req, res) {
      let jsonStr = ''
      req.on('data', function (data) {
        jsonStr += data
      })
      req.on('end', function () {
        log2file(`getUserInfo:${jsonStr}`)
        resolve(JSON.parse(jsonStr))
      })
    })
  })
}

/**
 * 获取接口调用凭证accessToken（全局使用，accessToken用于获取jsapi_ticket，jsapi_ticket用于生成权限签名）
 * @returns {Promise}
 */
function getApiAccessToken () {
  let apiAccessToken = '' // 凭证
  let needRefresh = true // 是否需要刷新凭证
  if (fs.existsSync('./api-access-token.txt')) {  // 从文件系统中获取（代替数据库）
    const jsonData = fs.readFileSync('./api-access-token.txt', { flag: 'r', encoding: 'utf8' })
    console.log('getApiAccessToken cached: ', jsonData)
    apiAccessToken = jsonData.accessToken
    const expiresAt = jsonData.expiresAt
    // 如果没过期不需要重新获取
    if (expiresAt > Date.now()) {
      needRefresh = false
    }
  }

  if (needRefresh) {
    // 从微信服务器中获取
    return new Promise((resolve, reject) => {
      https.get('https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' + APP_ID + '&secret=' + APP_SECRET, function (req, res) {
        let jsonStr = ''
        req.on('data', function (data) {
          jsonStr += data
        })
        req.on('end', function () {
          log2file(`refresh apiAccessToken:${jsonStr}`)
          const ret = JSON.parse(jsonStr)
          apiAccessToken = ret.access_token
          const expiresAt = Date.now() + ret.expires_in * 1000 // 设置失效时间
          if (apiAccessToken) {
            // 将凭证和失效时间覆盖写入文件系统
            fs.writeFileSync('./api-access-token.txt', JSON.stringify({ accessToken: apiAccessToken, expiresAt }), { flag: 'w', encoding: 'utf8' })
            resolve(apiAccessToken)
          }
          else {
            reject('apiAccessToken empty:' + apiAccessToken)
          }
        })
      })
    })
  }
  else {
    return Promise.resolve(apiAccessToken)
  }
}

/**
 * 检测用户的页面授权凭证是否失效
 */
function checkPageAccessToken (openId) {
  const pageAccessToken = openId2accessToken[openId]
  return new Promise((resolve, reject) => {
    https.get(`https://api.weixin.qq.com/sns/auth?access_token=${pageAccessToken}&openid=${openId}`, function (req, res) {
      let jsonStr = ''
      req.on('data', function (data) {
        jsonStr += data
      })
      req.on('end', function () {
        log2file(`checkPageAccessToken:${jsonStr}`)
        const res = JSON.parse(jsonStr)
        if (res['errcode'] === 0) {
          resolve(res)
        }
        else {
          resolve(res)
        }
      })
    })
  })
}

/**
 * 刷新授权凭证
 */
function refreshPageAccessToken (openId) {
  const refreshToken = openId2refreshToken[openId]
  return new Promise((resolve, reject) => {
    https.get(`https://api.weixin.qq.com/sns/oauth2/refresh_token?appid=${APP_ID}&grant_type=refresh_token&refresh_token=${refreshToken}`, function (req, res) {
      let jsonStr = ''
      req.on('data', function (data) {
        jsonStr += data
      })
      req.on('end', function () {
        log2file(`refreshPageAccessToken:${jsonStr}`)
        const res = JSON.parse(jsonStr)
        openId2accessToken[openId] = res.access_token
        openId2refreshToken[openId] = res.refresh_token
        resolve()
      })
    })
  })
}

/**
 * 获取缓存中的ticket
 * @param {boolean} accessToken
 * @returns {Promise}
 */
function getTicket (accessToken) {
  if (fs.existsSync('./ticket.txt')) {  // 从文件系统中获取
    const ticket = fs.readFileSync('./ticket.txt', { flag: 'r', encoding: 'utf8' })
    console.log('get cached ticket: ', ticket)
    return Promise.resolve(ticket)
  }
  // 从微信服务器中获取
  else {
    return new Promise((resolve, reject) => {
      https.get('https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token=' + accessToken + '&type=jsapi', function (req, res) {
        let jsonStr = ''
        req.on('data', function (data) {
          jsonStr += data
        })
        req.on('end', function () {
          log2file(`refresh ticket:${jsonStr}`)
          const ticket = JSON.parse(jsonStr)['ticket']
          if (ticket) {
            fs.writeFileSync('./ticket.txt', ticket, { flag: 'w', encoding: 'utf8' })
            resolve(ticket)
          }
          else {
            reject('ticket empty:' + ticket)
          }
        })
      })
    })
  }
}

function log2file (log) {
  fs.writeFileSync('./std-console.txt', `${new Date().toLocaleTimeString()} : ${log}\n`, { flag: 'a', encoding: 'utf8' })
}

app.listen(4001)