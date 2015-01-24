class App.Node extends cc.Node
  constructor: (options)->
    super
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
    @setScale @options.scale

  _set_position: ->
    size       = @getContentSize()
    half_width = size.width * Math.abs(@getScaleX()) / 2

    @minimum = half_width
    @maximum = @parent.size.width - half_width

    @options.x = @maximum if @options.x > @maximum
    @options.x = @minimum if @options.x < @minimum

    @setPosition @options.x, @options.y

  onEnter: ->
    @_set_scale() if @options.scale
    @_set_position() if @options.x and @options.y
    super
    @[@events.enter].apply this, arguments if @[@events.enter] instanceof Function

