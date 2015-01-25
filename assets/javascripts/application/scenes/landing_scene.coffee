class App.Scenes.LandingScene extends cc.Scene
  onEnter: ->
    super
    @size = cc.winSize
    @touchables = []
    @_render_lamb_face()
    @_render_title()
    @_render_menus()
    @_render_copyright()
    @_render_common_cc()

    @_startEventListener()


  _render_lamb_face: ->
    @lamb_face = new cc.Sprite res.landing.background
    @lamb_face.attr x: @size.width/2, y: @size.height/2, opacity: 0
    @addChild @lamb_face
    @lamb_face.runAction cc.sequence cc.fadeIn 1.6, 3

  _render_title: ->
    @title = @_create_sprite 0, 0, 416, 20
    @title.attr x: @size.width/2, y: 200, opacity: 0, scale: 1.2
    @title.setAnchorPoint 0.5, 0
    @addChild @title
    @title.runAction cc.sequence new cc.DelayTime(1.6), cc.spawn(cc.fadeIn(1.0, 3), cc.scaleTo(1, 1))


  _render_menus: ->
    @score_button = @_create_sprite 0, 68, 396, 88
    @pvp_button   = @_create_sprite 400, 68, 396, 88
    @score_button.attr opacity: 0, x: @size.width/2 - 410, y: 70
    @pvp_button.attr   opacity: 0, x: @size.width/2 + 14, y: 70


    @addChild @score_button
    @addChild @pvp_button
    @score_button.runAction cc.sequence new cc.DelayTime(3), cc.spawn(cc.fadeIn(1.0, 3))
    @pvp_button.runAction   cc.sequence new cc.DelayTime(3.4), cc.spawn(cc.fadeIn(1.0, 3))

    @touchables.push @score_button
    @touchables.push @pvp_button

    @score_button.onTouchBegan = =>
      cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.ScoreStageScene, new cc.Color(0,0,0);

    @pvp_button.onTouchBegan = => alert 'working for this now'


  _render_copyright: ->
    @copyright = @_create_sprite 2, 39, 300, 14
    @copyright.attr x: @size.width/2-150, y: 20, opacity: 0
    @addChild @copyright
    @copyright.runAction cc.sequence new cc.DelayTime(3.8), cc.spawn(cc.fadeIn(1.0, 3))

  _render_common_cc: ->
    @common_cc = @_create_sprite 440, 0, 126, 40
    @common_cc.attr x: @size.width-136, y: 10, opacity: 0
    @addChild @common_cc
    @common_cc.runAction cc.sequence new cc.DelayTime(4.1), cc.spawn(cc.fadeIn(1.0, 3))


  _create_sprite: (x1, y1, x2, y2) ->
    output = new cc.Sprite res.landing.sprite, new cc.Rect(x1,y1,x2,y2);
    output.setAnchorPoint 0, 0
    output

  _startEventListener: ->
    @touchListener = cc.EventListener.create
      event: cc.EventListener.TOUCH_ONE_BY_ONE
      onTouchBegan: (touch, event) =>
        touched_nodes = []
        _(@touchables).each (node) ->
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



