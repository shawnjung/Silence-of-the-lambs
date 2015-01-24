class App.Scenes.StageScene extends cc.Scene
  lambs_count: 1
  onEnter: ->
    super
    @size = cc.winSize
    @_render_background()
    @_render_lambs()
    @_startEventListener()


  _render_lambs: ->
    @lambs = []
    _(_.range(0, 15)).each =>
      lamb = new App.Scenes.Stage.LambNode
      x = parseInt(Math.random() * @size.width)
      y = parseInt(Math.random() * @size.height)
      lamb.attr x: x, y: y-30
      lamb.setScale 0.5-(y/@size.height*0.4)
      @lambs.push lamb
      @addChild lamb, 640+(y*-1)
    window.lambs = @lambs

  _render_background: ->
    @background = new App.Scenes.Stage.BackgroundNode
    @addChild @background


  _startEventListener: ->
    @touchListener = cc.EventListener.create
      event: cc.EventListener.TOUCH_ONE_BY_ONE
      onTouchBegan: (touch, event) =>
        touched_nodes = []
        _(@lambs).each (node) ->
          locationInNode = node.convertToNodeSpace(touch.getLocation())
          size = node.getContentSize()
          rect = cc.rect(0, 0, size.width, size.height)
          touched_nodes.push node if cc.rectContainsPoint(rect, locationInNode)

        if touched_nodes.length
          touch.touched_node = _(touched_nodes).min (node) -> node.getPosition().y
        touch.touched_node.onTouchBegan.apply touch.touched_node, arguments if touch.touched_node


      onTouchMoved: (touch) =>
        if touch.touched_node
          touch.touched_node.onTouchMoved.apply touch.touched_node, arguments

      onTouchEnded: (touch) =>
        if touch.touched_node
          touch.touched_node.onTouchEnded.apply touch.touched_node, arguments


    cc.eventManager.addListener @touchListener, this