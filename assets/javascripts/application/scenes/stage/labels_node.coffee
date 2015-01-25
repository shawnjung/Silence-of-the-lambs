class App.Scenes.Stage.LabelsNode extends cc.Node
  constructor: ->
    super
    @_render_current_score()

  _render_current_score: ->
    @score_label = new App.Scenes.Stage.Labels.NumbersNode numbers: 0, align: 'right'
    @score_label.attr x: cc.winSize.width-20, y: 550, scale: 0.6
    @addChild @score_label