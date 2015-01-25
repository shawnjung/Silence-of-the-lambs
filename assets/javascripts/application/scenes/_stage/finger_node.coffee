class App.Scenes.Stage.FingerNode extends cc.Node
  constructor: ->
    super
    @setAnchorPoint 0.5, 1
    @setContentSize 142, 170
    @_render_finger()

  start: ->
    @setRotation -10
    @finger.runAction cc.spawn cc.moveTo(0.5, cc.p(0, 0)), cc.fadeIn(0.5), new cc.CallFunc =>
      @_run_circle_animation()

  stop: ->
    @stopAllActions()
    @runAction cc.sequence cc.scaleTo(0.3, 0), new cc.CallFunc =>
      @parent.removeChild this, true


  _render_finger: ->
    @finger = new cc.Sprite res.stage.lamb, new cc.Rect(560, 330, 142, 170);
    @finger.setAnchorPoint 0, 0
    @finger.attr x: 0, y: -60, opacity: 0
    @addChild @finger, 1


  _run_circle_animation: ->
    @runAction new cc.RepeatForever cc.sequence new cc.CallFunc(=> @_render_circle()),
                                                new cc.DelayTime(0.5)

  _render_circle: ->
    circle = new cc.Sprite res.stage.lamb, new cc.Rect(735, 358, 142, 142);
    circle.setAnchorPoint 0.5, 0.5
    circle.attr x:56, y: 160, opacity: 0, scale: 0.3
    @addChild circle, 0
    circle.runAction cc.sequence  cc.spawn(cc.scaleTo(0.5, 0.9), cc.fadeIn(0.5)),
                                  cc.spawn(cc.scaleTo(0.5, 1.5), cc.fadeOut(0.5)),
                                  new cc.CallFunc =>
                                    @removeChild circle, true