$socket = io()
$socket.on 'connected', (response) =>
  $socket._pvp_id = response.user_id

$socket.on 'room-created', (response) =>
  cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.PVPLandingScene(response), new cc.Color(0,0,0);

$socket.on 'invalid-room', => alert 'The room is invalid or full.'
$socket.on 'left-player', => alert 'Your partner left this game.'

$socket.on 'pvp-started', (response) =>
  cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.PVPStageScene(response), new cc.Color(0,0,0);

$socket.on 'reset-lamb', (response) =>
  # $socket._pvp_stage_scene is defined when PVPStageScene is initalized
  lamb_controller = $socket._pvp_stage_scene.get_lamb response.id
  lamb_controller.reset response

$socket.on 'add-lamb', (response) =>
  $socket._pvp_stage_scene.add_lamb response

$socket.on 'pvp-won', (response) =>
  lamb_controller = $socket._pvp_stage_scene.get_lamb response.lamb_id
  $socket._pvp_stage_scene.trigger 'pvp-won', lamb_controller, response

$socket.on 'pvp-lost', (response) =>
  lamb_controller = $socket._pvp_stage_scene.get_lamb response.lamb_id
  $socket._pvp_stage_scene.trigger 'pvp-lost', lamb_controller, response

window.$socket = $socket