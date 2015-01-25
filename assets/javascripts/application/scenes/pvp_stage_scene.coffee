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


  add_lamb: (data) ->
    data.skin = 'enermy' if data.owner_id isnt $socket._pvp_id
    lamb = @render_lamb data
    lamb._pvp_lamb_id = data.id
    @_lambs_by_id[data.id] = lamb

  _render_lambs: ->
    @_lambs_by_id = {}
    _(@options.lambs).each (data) => @add_lamb data


  _set_events: ->
    @on 'pvp-won', (lamb) =>
      @stop_all_lambs()
      @zoom_lamb lamb, => lamb.speak()

    @on 'pvp-lost', (lamb) =>
      @stop_all_lambs()
      @zoom_lamb lamb, => lamb.speak()


  get_lamb: (id) -> @_lambs_by_id[id]