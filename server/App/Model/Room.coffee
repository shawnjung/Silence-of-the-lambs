class Room extends Backbone.Model
  initialize: ->
    @players = []
    @lambs   = new App.Collection.Lambs [], model: App.Model.Lamb

  set_player: (player, options)->
    @players[options.as] = player

  init_data: ->
    @lambs.reset()
    _(@players).each (player, index) =>
      _(3).times =>
        lamb = @lambs.add id: uuid.v4()
        lamb.set_owner player, index

  as_json: ->
    lambs: @lambs.toJSON()

  is_full: -> @players.length is 2

  start_pvp: ->
    @init_data()
    @emit_each 'pvp-started', @as_json()

  emit_each: (command, params) ->
    _(@players).each (player) ->
      player.socket.emit command, params


module.exports = Room