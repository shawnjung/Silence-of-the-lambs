class App.Scenes.Stage.LambNode extends cc.Node
  constructor: (options) ->
    super
    @skin = options.skin or res.stage.lamb
    @setAnchorPoint 0.5, 0
    @setContentSize 540, 396

    @_render_body()
    @_render_face()
    @_render_legs()
    @_render_shadow()


  stop: ->
    _(@legs).each (leg) -> leg.stopAllActions()


  _create_sprite: (x1, y1, x2, y2) ->
    output = new cc.Sprite @skin, new cc.Rect(x1,y1,x2,y2);
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

  _render_shadow: ->
    @shadow = @_create_sprite 0, 340, 540, 80
    @shadow.attr y: -30
    @addChild @shadow, 0