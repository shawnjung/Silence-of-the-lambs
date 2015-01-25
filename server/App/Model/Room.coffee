class Room extends Backbone.Model
  init_data: ->
    @players = []

  set_player: (player, options)->
    @players[options.as] = player


  as_json: -> {}

  is_full: -> @players.length is 2

  start_pvp: ->
    @emit_each 'pvp-started', @as_json()

  emit_each: (command, params) ->
    _(@players).each (player) ->
      player.socket.emit command, params


module.exports = Room