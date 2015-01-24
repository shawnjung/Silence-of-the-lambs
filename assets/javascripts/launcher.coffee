cc.game.onStart = ->
    cc.view.adjustViewPort true
    cc.view.setDesignResolutionSize 1136, 640, cc.ResolutionPolicy.SHOW_ALL
    cc.view.resizeWithBrowserSize true

    # load resources
    cc.LoaderScene.preload resource_urls, ->
      cc.director.runScene new App.Scenes.StageScene

cc.game.run()