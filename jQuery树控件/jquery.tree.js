;(function () {
  var Tree = function (ele, data, opt) {
    this.$el = ele
    this.data = data
    this.defaults = {}
    this.options = $.extend({}, this.defaults, opt)
    this.selectedNodes = {}

    var _id2node = {}
    var _LI_HEIGHT = 24
    var _htmlArray
    var mdStr = ''

    function _getChildrenHeight (children) {
      var i, node, totalHeight = 0
      for (i = 0; i < children.length; i++) {
        node = children[i]
        totalHeight += _LI_HEIGHT
        if (node.children && node.open) {
          totalHeight += _getChildrenHeight(node.children)
        }
      }
      return totalHeight
    }

    function _generateDOM (node, level) {
      var i
      _id2node[node.id] = node
      if (node.children) {
        var nodeClass = 'fold '
        nodeClass += node.open ? 'open ' : 'close '
        level === 0 && (nodeClass += 'root ')
        _htmlArray.push('<li class="' + nodeClass + '" data-index="' + node.id + '">')
        _htmlArray.push('<i></i><a>' + node.label + '</a><ul>')
        for (i = 0; i < node.children.length; i++) {
          _generateDOM(node.children[i], level + 1)
        }
        _htmlArray.push('</ul></li>')
      }
      else {
        _htmlArray.push('<li class="file" id="li_' + node.id + '" data-index="' + node.id + '"><i></i><a>' + node.label + '</a></li>')
      }
    }

    var folding = false

    function _bindEvent (_this) {
      _this.$el.on('click', 'i', function (e) {
        if (folding) return false
        var $li = $(this).parent()
        if (e.button === 0 && $li.hasClass('fold')) {
          var node = _id2node[$li.data('index')]
          var $ul = $li.children('ul')
          if ($li.hasClass('open')) {
            node.open = false
            $li.removeClass('open').addClass('close')
            folding = true
            $ul.css({ height: _getChildrenHeight(node.children) }).animate({ height: 0 }, 300, function () {
              // $ul.css({height: 'auto'})
              folding = false
            })
          }
          else if ($li.hasClass('close')) {
            node.open = true
            $li.removeClass('close').addClass('open')
            folding = true
            $ul.css({ height: 0 }).animate({ height: _getChildrenHeight(node.children) }, 300, function () {
              $ul.css({ height: 'auto' })
              folding = false
            })
          }
        }
        return false
      })
      _this.$el.on('click', 'a', function (e) {
        var $li = $(this).parent()
        var node = _id2node[$li.data('index')]
        if (node && !node.children) {
          for (var nId in _this.selectedNodes) {
            if (_this.selectedNodes.hasOwnProperty(nId)) {
              $(document.getElementById('li_' + nId)).children('a').removeClass('active')
            }
          }
          _this.selectedNodes = {}
          _this.selectedNodes[node.id] = node
          $(this).addClass('active')
        }
        return false
      })
    }

    function _drawLines (nodeList, lv, endLv) {
      var spaces = ''
      var i
      if (typeof endLv === 'number') {
        spaces = endLv === 0 ? '     ' : '│    '
        for (i = 0; i < endLv; i++) {
          spaces += '     '
        }
        for (i = endLv + 1; i < lv; i++) {
          spaces += '│    '
        }
      }
      else {
        // spaces = endLv ? '│    ' : '     '
        for (i = 0; i < lv; i++) {
          spaces += '│    '
        }
      }
      for (i = 0; i < nodeList.length; i++) {
        var node = nodeList[i]
        if (nodeList.length === 1 || i === nodeList.length - 1) {
          mdStr += spaces + '└── ' + node.label + '\n'
          if (node.children && node.children.length) {
            _drawLines(node.children, lv + 1, lv)
          }
        }
        else if (i === 0) {
          mdStr += spaces + (lv === 0 ? '┌── ' : '├── ') + node.label + '\n'
          if (node.children && node.children.length) {
            _drawLines(node.children, lv + 1, endLv)
          }
        }
        else {
          mdStr += spaces + '├── ' + node.label + '\n'
          if (node.children && node.children.length) {
            _drawLines(node.children, lv + 1, endLv)
          }
        }
      }
    }

    this.init = function () {
      _htmlArray = ['<ul class="tree">']
      _generateDOM(this.data, 0)
      _htmlArray.push('</ul>')
      this.$el.html(_htmlArray.join(''))

      _bindEvent(this)
    }

    this.getMDStr = function () {
      _drawLines(this.data.children, 0)
      return mdStr
    }
  }
  $.fn.tree = function (data) {
    var tree = new Tree(this, data)
    tree.init()
    return tree
  }
})()