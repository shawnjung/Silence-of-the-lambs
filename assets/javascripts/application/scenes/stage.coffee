class App.Scenes.StageScene extends cc.Scene
  lambs_count: 10
  y_lines: [0, 100, 190, 270, 340, 400, 450, 490, 530, 560]
  onEnter: ->
    super
    @size = cc.winSize
    @_render_background()
    @_render_lambs()
    @_startEventListener()


  _render_lambs: ->
    @lambs = []
    _(_.range(0, @lambs_count)).each =>
      x = parseInt Math.random() * @size.width
      y = _(@y_lines).sample()

      lamb = new App.Scenes.Stage.LambController
        scale: 0.5-(y/@size.height*0.45), x: x, y: y

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