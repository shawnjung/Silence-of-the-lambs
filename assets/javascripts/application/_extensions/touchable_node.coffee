class App.NodeController extends cc.Node
  constructor: (options)->
    super
    @setAnchorPoint 0.5, 0
    @options = options or {}

    @initialize options
    #@_startEventListener()

  initialize: ->

  events: {}

  # _startEventListener: ->
  #   @touchListener = cc.EventListener.create
  #     event: cc.EventListener.TOUCH_ONE_BY_ONE
  #     onTouchBegan: (touch, event) =>
  #       locationInNode = @convertToNodeSpace(touch.getLocation())
  #       size = @getContentSize()
  #       rect = cc.rect(0, 0, size.width, size.height)
  #       return @_onTouchBegan.apply this, arguments if cc.rectContainsPoint(rect, locationInNode)
  #       false

  #     onTouchMoved: => @_onTouchMoved.apply this, arguments
  #     onTouchEnded: => @_onTouchEnded.apply this, arguments


  #   cc.eventManager.addListener @touchListener, this

  onTouchBegan: ->
    if @[@events.touchstart] instanceof Function
      @[@events.touchstart].apply this, arguments
    else
      true

  onTouchMoved: ->
    @[@events.touchmove].apply this, arguments if @[@events.touchmove] instanceof Function

  onTouchEnded: ->
    @[@events.touchend].apply this, arguments if @[@events.touchend] instanceof Function

  _set_scale: ->
    @speed_per_sec = @speed_per_sec*@options.scale
    @main_node.setScale @options.scale
    width  = parseInt @main_node.getContentSize().width*@options.scale
    height = parseInt @main_node.getContentSize().height*@options.scale
    @setContentSize width, height
    @main_node.setPosition width/2, 0

  _set_position: ->
    size       = @getContentSize()
    half_width = size.width / 2

    @minimum = half_width
    @maximum = @parent.size.width - half_width

    @options.x = @maximum if @options.x > @maximum
    @options.x = @minimum if @options.x < @minimum

    @setPosition @options.x, @options.y

  onEnter: ->
    @_set_scale() if @options.scale
    @_set_position() if @options.x isnt undefined and @options.y isnt undefined
    super
    @[@events.enter].apply this, arguments if @[@events.enter] instanceof Function

