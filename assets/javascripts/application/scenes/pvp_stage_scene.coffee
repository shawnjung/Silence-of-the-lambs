class App.Scenes.PVPStageScene extends App.Scenes.Stage.BaseScene
  lamb_controller: App.Scenes.Stage.PVPLambController
  constructor: (options) ->
    super
    $socket._pvp_stage_scene = this
    @options = options

    @_render_game_elements()
    @_render_lambs()
    @_set_events()

    @_startEventListener()



  _render_lambs: ->
    @_lambs_by_id = {}
    _(@options.lambs).each (lamb_data) =>
      lamb_data.skin = 'enermy' if lamb_data.owner_id isnt $socket._pvp_id
      lamb = @render_lamb lamb_data
      lamb._pvp_lamb_id = lamb_data.id
      @_lambs_by_id[lamb_data.id] = lamb


  _set_events: ->
    @on 'pvp-won', (lamb) =>
      @stop_all_lambs()
      @zoom_lamb lamb, => lamb.speak()

    @on 'pvp-lost', (lamb) =>
      @stop_all_lambs()
      @zoom_lamb lamb, => lamb.speak()


  get_lamb: (id) -> @_lambs_by_id[id]