class cc.TouchableNode extends cc.Node
  constructor: ->
    super
    @initialize()
    @_startEventListener()

  initialize: ->

  events: {}

  _startEventListener: ->
    @touchListener = cc.EventListener.create
      event: cc.EventListener.TOUCH_ONE_BY_ONE
      onTouchBegan: (touch, event) =>
        locationInNode = @convertToNodeSpace(touch.getLocation())
        size = @getContentSize()
        rect = cc.rect(0, 0, size.width, size.height)
        return @_onTouchBegan.apply this, arguments if cc.rectContainsPoint(rect, locationInNode)
        false

      onTouchMoved: => @_onTouchMoved.apply this, arguments
      onTouchEnded: => @_onTouchEnded.apply this, arguments


    cc.eventManager.addListener @touchListener, this

  _onTouchBegan: ->
    if @[@events.touchstart] instanceof Function
      @[@events.touchstart].apply this, arguments
    else
      true

  _onTouchMoved: ->
    @[@events.touchmove].apply this, arguments if @[@events.touchmove] instanceof Function

  _onTouchEnded: ->
    @[@events.touchend].apply this, arguments if @[@events.touchend] instanceof Function