class App.Scenes.PVPLandingScene extends App.Scene
  constructor: (options) ->
    super
    @size = cc.winSize
    @options = options
    @_render_background()
    @_render_title()
    @_render_button()
    @_render_room_id()
    @_render_back_button()




  _render_background: ->
    @background = new cc.Sprite res.pvp_landing.background
    @background.attr x: 0, y: 0, anchorX: 0, anchorY: 0
    @addChild @background


  _render_title: ->
    @title = new cc.Sprite res.pvp_landing.sprite, new cc.Rect(0,0,532,48)
    @title.attr x: @size.width/2, y: 490
    @title.setAnchorPoint 0.5, 0
    @addChild @title
    @title.runAction new cc.RepeatForever cc.sequence(cc.fadeTo(0.5, 0), cc.fadeTo(0.5, 255))

  _render_button: ->
    @button = new cc.Sprite res.pvp_landing.sprite, new cc.Rect(2,51,396,88)
    @button.attr x: @size.width/2, y: 80
    @button.setAnchorPoint 0.5, 0
    @addChild @button
    @touchables.push @button

    @button.onTouchBegan = =>
      room_id = prompt 'Please provide 5 digits number:'
      console.log room_id
      if room_id is @options.room_id
        alert "That's your room number."
      else if room_id
        $socket.emit 'join-room', room_id: room_id
      false

  _render_room_id: ->
    @numbers = []
    _(@options.room_id.toString()).each (number, index) =>
      number = new cc.LabelTTF number, 'Arial', 110
      number.setAnchorPoint 0.5, 0.5
      number.attr x: 288+(140*index), y: 324, fillStyle: new cc.Color(0,0,0)
      @addChild number
      @numbers.push number


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



  _render_back_button: ->
    @back_button = new cc.Sprite res.stage.lamb, new cc.Rect(0, 430, 110, 106);
    @back_button.setAnchorPoint 0, 0
    @back_button.attr x: 10, y: 550, scale: 0.7
    @addChild @back_button

    @touchables.push @back_button

    @back_button.onTouchBegan = =>
      cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.LandingScene, new cc.Color(0,0,0);