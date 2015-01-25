class Room extends Backbone.Model
  active: true
  initialize: ->
    @players = []
    @lambs   = new App.Collection.Lambs [], model: App.Model.Lamb
    @lambs.room = this

  set_player: (player, options)->
    @players[options.as] = player

  init_data: ->
    @active = true
    @lambs.reset()
    _(@players).each (player, index) =>
      _(3).times =>
        lamb = @lambs.add id: uuid.v4()
        lamb.set_owner player


  add_lamb: (options) ->
    _(@players).each (player) =>
      if player isnt options.by
        lamb = @lambs.add id: uuid.v4()
        lamb.set_owner player
        @emit_each 'add-lamb', lamb.toJSON()

  as_json: ->
    lambs: @lambs.toJSON()

  is_full: -> @players.length is 2

  start_pvp: ->
    @init_data()
    _(@players).each (player) => player.room = this
    @emit_each 'pvp-started', @as_json()
    @lambs.each (lamb) -> lamb.start_counter with_delay: true

  end_pvp: (options) ->
    if @active
      @active = false
      _(@players).each (player) =>
        if player is options.loser
          player.socket.emit 'pvp-lost', lamb_id: options.lamb.id
        else
          player.socket.emit 'pvp-won', lamb_id: options.lamb.id



  emit_each: (command, params) ->
    _(@players).each (player) ->
      player.socket.emit command, params


module.exports = Room