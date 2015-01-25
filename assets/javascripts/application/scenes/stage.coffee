class App.Scenes.StageScene extends cc.Scene
  lambs_count: 10
  current_score: 0
  y_lines: [0, 100, 190, 270, 340, 400, 450, 490]

  onEnter: ->
    super
    window.stage = this
    @size = cc.winSize

    @setAnchorPoint 0.5, 0.5
    @setPosition 0, 0

    @_render_game_elements()
    @_render_game_overlays()

    @elements.on 'time-over', (lamb) =>
      lamb.speak()
      @stop_all_lambs()
      @zoom_lamb lamb, =>
        lamb.speak()

    @on 'score-earned', (score) =>
      @current_score += score
      @labels.score_label.update @current_score

    @_startEventListener()


  zoom_lamb: (lamb, callback) ->
    window.last_lamb = lamb
    lamb_position = lamb.getPosition()
    lamb_size     = lamb.getContentSize()
    scale         = 1.6 + 4*(1 - lamb.lamb_node.getScaleY()*2)
    @elements.setAnchorPoint (lamb_position.x/@size.width), (lamb_position.y/@size.height)
    reposition = @elements.getAnchorPointInPoints()
    @elements.setPosition reposition.x, reposition.y
    x = reposition.x - (reposition.x - @size.width/2)
    y = reposition.y - (reposition.y - @size.height/2)-lamb_size.height

    @elements.runAction cc.sequence cc.spawn(cc.EaseIn.create(cc.moveTo(0.4, cc.p(x, y)), 5) , cc.EaseIn.create(cc.scaleTo(0.4, scale), 5)),
                            new cc.CallFunc -> lamb.speak()


  stop_all_lambs: ->
    _(@lambs).each (lamb) -> lamb.stop()


  _render_game_elements: ->
    @elements = new cc.Node
    @elements.size = @size
    @elements.attr width: @size.width, height: @size.height
    @elements.setAnchorPoint 0, 0

    @_render_background()
    @_render_lambs()
    @addChild @elements

  _render_background: ->
    @background = new App.Scenes.Stage.BackgroundNode
    @elements.addChild @background, 0

  _render_lambs: ->
    @lambs = []
    _(_.range(0, @lambs_count)).each =>
      x = parseInt Math.random() * @size.width
      y = _(@y_lines).sample()+20

      lamb = new App.Scenes.Stage.LambController
        scale: 0.5-(y/@size.height*0.45), x: x, y: y

      @lambs.push lamb
      @elements.addChild lamb, 640+(y*-1)

    window.lambs = @lambs

  _render_game_overlays: ->
    @labels = new App.Scenes.Stage.LabelsNode
    @labels.attr x: 0, y: 0, width: @size.width, height: @size.height
    @addChild @labels, 700


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