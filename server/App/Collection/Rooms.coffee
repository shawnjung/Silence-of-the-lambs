class Rooms extends Backbone.Collection
  create_id: ->
    output = ("0000"+parseInt(Math.random()*99999)).substr(-5)
    return create_id() if @get output
    output



module.exports = Rooms