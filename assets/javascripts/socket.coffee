$socket = io socket_server_url
$socket.on 'connected', (response) =>
  $socket._pvp_id = response.user_id

$socket.on 'room-created', (response) =>
  cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.PVPLandingScene(response), new cc.Color(0,0,0);

$socket.on 'invalid-room', => alert 'The room is invalid or full.'
$socket.on 'pvp-started', (response) =>
  cc.director.runScene cc.TransitionFade.create 1, new App.Scenes.PVPStageScene(response), new cc.Color(0,0,0);

window.$socket = $socket