class App.Scenes.Stage.GaugeNode extends cc.Node
  constructor: (options) ->
    super
    @setAnchorPoint 0.5, 0
    @setContentSize 200, 18
    @setPosition 50, 0
    @setScale 0.4

    @_render_background()
    @_render_bar()

  onEnter: ->
    super
    @_set_position()


  start: (options, callback) ->
    finished = new cc.CallFunc -> callback()
    @gauge_animation  = cc.sequence cc.scaleTo(options.patience, 1, 1),
                                    finished

    @bar.runAction @gauge_animation

  reset: ->
    @bar.stopAction @gauge_animation
    @bar.setScaleX 0
    @bar.runAction @gauge_animation



  _create_sprite: (x1, y1, x2, y2) ->
    output = new cc.Sprite res.stage.lamb, new cc.Rect(x1,y1,x2,y2);
    output.setAnchorPoint 0, 0
    output

  _render_bar: ->
    @bar = @_create_sprite 540, 300, 200, 18
    @bar.setScaleX 0
    @addChild @bar, 1


  _render_background: ->
    @background = @_create_sprite 740, 300, 200, 18
    @addChild @background, 0

  _set_position: ->
    size = @parent.getContentSize()
    x = size.width/2
    y = size.height+20

    @setPosition x, y