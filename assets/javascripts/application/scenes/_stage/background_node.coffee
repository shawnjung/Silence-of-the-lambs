class App.Scenes.Stage.BackgroundNode extends cc.Node
  constructor: ->
    super
    @size = cc.winSize
    @_render_grass()


  _render_grass: ->
    @grass = new cc.Sprite res.stage.backgrounds.grass
    @grass.attr x: @size.width/2, y: @size.height/2
    @addChild @grass

