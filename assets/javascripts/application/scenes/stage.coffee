class App.Scenes.StageScene extends cc.Scene
  lambs_count: 1
  onEnter: ->
    super
    @size = cc.winSize
    @_render_background()
    @_render_lambs()



  _render_lambs: ->
    @lambs = []
    _(_.range(0, @lambs_count)).each =>
      lamb = new App.Scenes.Stage.LambNode
      lamb.attr x: @size.width/2, y: @size.height/2
      lamb.setScale 0.5
      @lambs.push lamb
      @addChild lamb
    window.lambs = @lambs

  _render_background: ->
    @background = new App.Scenes.Stage.BackgroundNode
    @addChild @background