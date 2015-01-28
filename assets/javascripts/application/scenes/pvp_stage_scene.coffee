class App.Scenes.PVPStageScene extends App.Scenes.Stage.BaseScene
  lamb_controller: App.Scenes.Stage.PVPLambController
  constructor: (options) ->
    super
    $socket._pvp_stage_scene = this
    @options = options

    @_render_game_elements()
    @_render_game_overlays()
    @_render_lambs()
    @_set_events()

    @_startEventListener()

    window.current_stage = this


  add_lamb: (data) ->
    data.skin = 'enermy' if data.owner_id isnt $socket._pvp_id
    lamb = @render_lamb data
    lamb._pvp_lamb_id = data.id
    @_lambs_by_id[data.id] = lamb

  _render_game_overlays: ->
    @labels = new App.Scenes.Stage.PVPLabelsNode
    @labels.attr x: 0, y: 0, width: @size.width, height: @size.height
    @addChild @labels, 700

  _render_lambs: ->
    @_lambs_by_id = {}
    _(@options.lambs).each (data) => @add_lamb data


  _set_events: ->
    @on 'pvp-won', (lamb) =>
      @stop_all_lambs()
      if lamb
        @zoom_lamb lamb, =>
          lamb.speak()
          lamb.show_gauge()
          @labels.activate_pvp_won()

      else
        @labels.activate_pvp_won()

    @on 'pvp-lost', (lamb) =>
      @stop_all_lambs()
      if lamb
        @zoom_lamb lamb, =>
          lamb.speak()
          lamb.show_gauge()
          @labels.activate_pvp_lost()

      else
        @labels.activate_pvp_lost()


  get_lamb: (id) -> @_lambs_by_id[id]