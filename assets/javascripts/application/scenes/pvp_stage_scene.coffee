class App.Scenes.PVPStageScene extends App.Scenes.Stage.BaseScene
  constructor: (options) ->
    super
    @options = options

    @_render_game_elements()
    @_render_lambs()

    @_startEventListener()



  _render_lambs: ->
