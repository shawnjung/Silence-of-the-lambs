class App.EventListener
  constructor: (options)->
    @listener = cc.EventListener.create
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

        @_play_touch_sound touch
        @_render_touch_circle touch


        if touch.touched_node and touch.touched_node.onTouchBegan instanceof Function
          touch.touched_node.onTouchBegan.apply touch.touched_node, arguments




      onTouchMoved: (touch) =>
        if touch.touched_node and touch.touched_node.onTouchMoved instanceof Function
          touch.touched_node.onTouchMoved.apply touch.touched_node, arguments

      onTouchEnded: (touch) =>
        if touch.touched_node and touch.touched_node.onTouchEnded instanceof Function
          touch.touched_node.onTouchEnded.apply touch.touched_node, arguments


  on: (scene) ->
    @current_scene = scene
    @current_scene._listener = @listener.clone()
    @touchables = @current_scene.touchables
    cc.eventManager.addListener @current_scene._listener, @current_scene

  off: (scene) ->
    cc.eventManager.removeListener scene._listener


  _play_touch_sound: (touch) ->
    cc.audioEngine.playEffect(res.audio.tap, false)

  _render_touch_circle: (touch) ->
    location = touch.getLocation()
    circle = new cc.Sprite res.stage.lamb, new cc.Rect(735, 358, 142, 142);
    circle.setAnchorPoint 0.5, 0.5
    circle.attr x: location.x, y: location.y, opacity: 0, scale: 0.4
    @current_scene.addChild circle, 1000
    circle.runAction cc.sequence  cc.spawn(cc.scaleTo(0.1, 0.8), cc.fadeIn(0.1)),
                                  cc.spawn(cc.scaleTo(0.1, 1.2), cc.fadeOut(0.1)),
                                  new cc.CallFunc =>
                                    @current_scene.removeChild circle, true