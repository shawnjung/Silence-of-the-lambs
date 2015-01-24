class App.Scenes.Stage.LambNode extends App.Node
  speed_per_sec: 50
  speaking: false
  walking: false
  moving: false
  initialize: ->
    @setAnchorPoint 0.5, 0
    @setContentSize 540, 396
    @_render_body()
    @_render_face()
    @_render_legs()

  events:
    'touchstart': 'smile_and_move'

  smile_and_move:  ->
    @speak()
    @walk()
    @move 400


  move: (x) ->
    unless @moving
      @moving = true
      x = x/@getScale()
      seconds = x/@speed_per_sec
      @runAction cc.sequence(cc.moveBy(seconds, cc.p(x, 0)))


  walk: ->
    unless @walking
      @walking = true
      left_animation = new cc.RepeatForever cc.sequence(cc.rotateTo(0.6, 70), cc.rotateTo(0.6, 110))
      right_animation = new cc.RepeatForever cc.sequence(cc.rotateTo(0.6, 110), cc.rotateTo(0.6, 70))
      @legs[0].runAction left_animation.clone()
      @legs[1].runAction right_animation.clone()
      @legs[2].runAction left_animation.clone()
      @legs[3].runAction right_animation.clone()

  stand: ->
    _(@legs).each (leg) =>
      leg.stopAllActions()
      leg.runAction cc.sequence cc.rotateTo(0.6, 90)

  speak: ->
    unless @speaking
      @speaking = true
      @face.setTextureRect new cc.Rect 891, 200, 99, 74


  _create_sprite: (x1, y1, x2, y2) ->
    output = new cc.Sprite res.stage.lamb, new cc.Rect(x1,y1,x2,y2);
    output.setAnchorPoint 0, 0
    output


  _render_body: ->
    @front_body = @_create_sprite 0, 0, 540, 326
    @front_body.attr x: 0, y: 70

    @back_body = @_create_sprite 541, 0, 450, 188
    @back_body.attr x: 30, y: 55

    @addChild @front_body, 10
    @addChild @back_body, 0


  _render_legs: ->
    @legs = []
    _(_.range(0, 4)).each (val, index) =>
      leg = @_create_sprite 540, 189, 228, 44
      leg.attr y: -30
      leg.setAnchorPoint 0.09, 0.5

      @addChild leg, 9-index
      @legs.push leg

    @legs[0].attr x: 360, y: 210, rotation: 90
    @legs[1].attr x: 420, y: 210, rotation: 90
    @legs[2].attr x: 90, y: 210, rotation: 90
    @legs[3].attr x: 150, y: 210, rotation: 90


  _render_face: ->
    @face = @_create_sprite 780, 200, 99, 74
    @face.attr x: 400, y: 250

    @addChild @face, 11
