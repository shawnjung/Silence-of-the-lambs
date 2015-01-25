class App.Scenes.Stage.PVPLambController extends App.Scenes.Stage.LambController
  events:
    'touchstart': 'send_touch_to_server'


  send_touch_to_server: ->
    $socket.emit 'touch-lamb', id: @_pvp_lamb_id