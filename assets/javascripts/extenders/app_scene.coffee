class App.Scene extends cc.Scene
  constructor: ->
    @touchables = []
    super

  onEnter: ->
    super
    $event_listener.on this

  onExit: ->
    super
    $event_listener.off this