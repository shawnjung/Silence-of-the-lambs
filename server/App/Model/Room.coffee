class Room extends Backbone.Model
  active: false
  initialize: ->
    @players = new App.Collection.Users [], model: App.Model.User
    @lambs   = new App.Collection.Lambs [], model: App.Model.Lamb
    @lambs.room = this


  init_data: ->
    @lambs.reset()
    @players.each (player) =>
      _(3).times =>
        lamb = @lambs.add id: uuid.v4()
        lamb.set_owner player


  set_player: (player)->
    @players.add player
    player.room = this


  unset_player: (user) ->
    @players.remove user
    @destroy() if @players.length is 0
    user.room = undefined


  add_lamb: (options) ->
    @players.each (player) =>
      if player isnt options.by
        lamb = @lambs.add id: uuid.v4()
        lamb.set_owner player
        @emit_each 'add-lamb', lamb.toJSON()


  as_json: ->
    lambs: @lambs.toJSON()


  is_full: -> @players.length is 2


  start_pvp: ->
    @active = true
    @init_data()
    @emit_each 'pvp-started', @as_json()
    @lambs.each (lamb) -> lamb.start_counter with_delay: true


  end_pvp: (options) ->
    lamb_id = if options.lamb then options.lamb.id else null
    if @active
      @active = false
      @players.each (player) =>
        if player is options.loser
          player.socket.emit 'pvp-lost', lamb_id: lamb_id
        else
          player.socket.emit 'pvp-won', lamb_id: lamb_id
      @lambs.each (lamb) -> lamb.clear_counter()


  emit_each: (command, params) ->
    @players.each (player) ->
      player.socket.emit command, params


  destroy: ->
    try @collection.remove this


module.exports = Room