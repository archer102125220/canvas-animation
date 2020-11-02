function DatePicker () {

  var _this = this
  this.$calendar = $('#_calendar-panel') // 日期弹窗
  this.$YYMM = this.$calendar.find('.YY-MM') // 顶部年月显示
  this.$btnControl = this.$calendar.find('.btn-control') // 头部年月跳转按钮
  this.$days = this.$calendar.find('.days') // 日期网格

  // 今天的年月日
  this.today = new Date()
  this.currentYear = this.today.getFullYear()
  this.currentMonth = this.today.getMonth()  // 月份数组的下标
  this.currentDate = this.today.getDate()

  // 日历头部显示的年月
  this.displayYear = this.currentYear
  this.displayMonth = this.currentMonth

  // 被选中的年月日
  this.selectYear = null
  this.selectMonth = null
  this.selectDate = null

  bindHandlers()

  /**
   * 进入上个月
   */
  this.prevMonth = function () {
    if (this.displayMonth === 0) {
      this.displayMonth = 11
      this.displayYear--
    }
    else {
      this.displayMonth--
    }
    update() // 更新日历
  }

  /**
   * 进入下个月
   */
  this.nextMonth = function () {
    if (this.displayMonth === 11) {
      this.displayMonth = 0
      this.displayYear++
    }
    else {
      this.displayMonth++
    }
    update() // 更新日历
  }

  /**
   * 进入前一年
   */
  this.prevYear = function () {
    this.displayYear--
    update() // 更新日历
  }

  /**
   * 进入后一年
   */
  this.nextYear = function () {
    this.displayYear++
    update() // 更新日历
  }

  /**
   * 显示控件
   */
  this.showCalendar = function () {
    this.$calendar.css({ display: 'block' })
    update() // 更新日历
  }

  /**
   * 隐藏控件
   */
  this.hideCalendar = function () {
    this.$calendar.css({ display: 'none' })
  }

  /**
   * 设置控件位置
   */
  this.setPosition = function () {
    this.$calendar.css({
      left: this.$input.offset().left + 'px',
      top: (this.$input.height() + this.$input.offset().top + 5) + 'px'
    })
  }

  /**
   * 更新日历
   */
  function update () {
    console.log(_this.$YYMM, _this.displayMonth + 1)
    _this.$YYMM.html(_this.displayYear + '年' + (_this.displayMonth + 1) + '月') // 更新头部年月数据
    updateDays()
  }

  /**
   * 更新日期网格数据
   */
  function updateDays () {

    var weekday, displayDate
    var rowCount = 1
    var gridHtmlArray = ['<li class="row"><ul>']

    // 插入上个月日期
    var endDateOfLastMonth = new Date(_this.displayYear, _this.displayMonth, 0).getDate() // 当前展示的年月的上个月的最后一天的日期
    var startWeekday = new Date(_this.displayYear, _this.displayMonth, 1).getDay() // 当前展示的年月的第一天是星期几
    for (weekday = 0; weekday < startWeekday; weekday++) {
      displayDate = endDateOfLastMonth - startWeekday + weekday + 1
      gridHtmlArray.push('<li data-day="' + displayDate + '" class="day disabled">' + displayDate + '</li>')
    }

    // 继续插入后面的日期
    var dayNum = new Date(_this.displayYear, _this.displayMonth + 1, 0).getDate() // 当前展示的年月的天数
    for (displayDate = 1; displayDate <= dayNum; displayDate++) {
      if (displayDate === _this.currentDate && _this.displayMonth === _this.currentMonth && _this.displayYear === _this.currentYear) { // 如果是今天
        gridHtmlArray.push('<li data-day="' + displayDate + '" class="day today">' + displayDate + '</li>')
      }
      else if (displayDate === _this.selectDate && _this.displayMonth === _this.selectMonth && _this.displayYear === _this.selectYear) { // 如果是选中的那天
        gridHtmlArray.push('<li data-day="' + displayDate + '" class="day focus">' + displayDate + '</li>')
      }
      else {
        gridHtmlArray.push('<li data-day="' + displayDate + '" class="day">' + displayDate + '</li>')
      }

      if (weekday === 6 && displayDate < dayNum) {
        // 如果到周六还没展示完整月则继续添加行
        gridHtmlArray.push('</ul><li class="row"><ul>')
        rowCount++
        weekday = 0
      }
      else {
        weekday++
      }
    }

    // 用下个月的日期补充玩本周
    var fromDate = 1 // 1号开始
    for (weekday; weekday < 7; weekday++) {
      gridHtmlArray.push('<li class="day disabled">' + (fromDate++) + '</li>')
    }

    gridHtmlArray.push('</ul></li>')

    _this.$days.html(gridHtmlArray.join(''))
  }

  /**
   * 绑定事件
   */
  function bindHandlers () {
    _this.$calendar.on('click', '.prev-month', function () { _this.prevMonth() })
    _this.$calendar.on('click', '.next-month', function () { _this.nextMonth() })
    _this.$calendar.on('click', '.prev-year', function () { _this.prevYear() })
    _this.$calendar.on('click', '.next-year', function () { _this.nextYear() })
  }
}