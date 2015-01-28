class App.Scenes.Stage.PVPLabelsNode extends cc.Node
  onEnter: ->
    super
    @_render_won_image()
    @_render_lost_image()
    @_render_back_button()
    @_render_restart_button()


  activate_pvp_won: ->
    @won_image.runAction cc.sequence new cc.DelayTime(0.5), cc.fadeIn(0.4)
    @activate_restart_button()

  activate_pvp_lost: ->
    @lost_image.runAction cc.sequence new cc.DelayTime(0.5), cc.fadeIn(0.4)
    @activate_restart_button()


  _render_won_image: ->
    @won_image = new cc.Sprite res.ending, new cc.Rect(0, 130, 1136, 120);
    @won_image.setAnchorPoint 0, 0
    @won_image.attr x: 0, y: 240, opacity: 0
    @addChild @won_image

  _render_lost_image: ->
    @lost_image = new cc.Sprite res.ending, new cc.Rect(0, 0, 1136, 120);
    @lost_image.setAnchorPoint 0, 0
    @lost_image.attr x: 0, y: 240, opacity: 0
    @addChild @lost_image


  activate_restart_button: ->
    @restart_button.runAction cc.sequence new cc.DelayTime(0.5), cc.fadeIn(0.4), new cc.CallFunc =>
      @parent.touchables = [@restart_button, @back_button]


  _render_back_button: ->
    @back_button = new cc.Sprite res.stage.lamb, new cc.Rect(0, 430, 110, 106);
    @back_button.setAnchorPoint 0, 0
    @back_button.attr x: 10, y: 550, scale: 0.7
    @addChild @back_button

    @parent.touchables.push @back_button

    @back_button.onTouchBegan = =>
      $socket.emit 'leave-room'
      cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.LandingScene, new cc.Color(0,0,0);
      false



  _render_restart_button: ->
    @restart_button = new cc.Sprite res.stage.lamb, new cc.Rect(110, 430, 110, 106);
    @restart_button.setAnchorPoint 0.5, 0
    @restart_button.attr x: cc.winSize.width/2, y: 60, opacity: 0
    @addChild @restart_button

    @restart_button.onTouchBegan = =>
      $socket.emit 'restart-pvp'
      false