
cc.game.onStart = ->
    cc.view.adjustViewPort true
    cc.view.setDesignResolutionSize 450, 800, cc.ResolutionPolicy.SHOW_ALL
    cc.view.resizeWithBrowserSize true

    resources = _(res).map (val, key) -> val

    # load resources
    cc.LoaderScene.preload resources, ->
      cc.director.runScene new App.Scenes.HelloWorld

cc.game.run()