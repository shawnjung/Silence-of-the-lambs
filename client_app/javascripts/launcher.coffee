cc.game.onStart = ->
  #cc.screen._supportsFullScreen = false
  cc.view.adjustViewPort true
  cc.view.setDesignResolutionSize 1136, 640, cc.ResolutionPolicy.SHOW_ALL
  cc.view.resizeWithBrowserSize true

  # load resources
  cc.LoaderScene.preload resource_urls, ->
    cc.audioEngine.playMusic(res.audio.background, true);
    cc.director.runScene new App.Scenes.LandingScene # new App.Scenes.ScoreStageScene # new App.Scenes.LandingScene
    window.$event_listener = new App.EventListener

cc.game.run()