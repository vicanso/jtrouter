_ = require 'underscore'
# FOR removeSession funciton
# crc32 = require 'buffer-crc32'
# hash = (sess) ->
#   crc32.signed JSON.stringify sess, (key, val) ->
#     if key != 'cookie'
#       val
#     else
#       undefined
###*
 * initRoutes 初始化路由处理
 * @param  {express对象} app   express的实例
 * @param  {Array} routeInfos  路由配置的信息列表
 * @return {[type]}  [description]
###
module.exports.initRoutes = (app, routeInfos) ->
  _.each routeInfos, (routeInfo) ->
    handle = (req, res, next) ->
      next = _.once next
      cbf = (err, renderData, statusCode = 200, headerOptions = {}) ->
        if err
          next err
          return
        # removeSession req
        if _.isNumber renderData
          tmp = statusCode
          statusCode = renderData
          renderData = tmp
        if _.isObject statusCode
          tmp = statusCode
          headerOptions = statusCode
          statusCode = tmp
        if !_.isNumber statusCode
          statusCode = 200
        if renderData
          template = renderData.template || routeInfo.template
          res.status statusCode
          if statusCode > 299 && statusCode < 400
            res.redirect statusCode, renderData
          else if template
            renderResponse req, res, template, renderData, headerOptions, next
          else
            if _.isObject renderData
              jsonResponse req, res, renderData, headerOptions, next
            else
              response req, res, renderData, headerOptions, next
        else
          res.send statusCode
      routeInfo.handler req, res, cbf, next
    middleware = routeInfo.middleware || []
    routes = routeInfo.route
    if !_.isArray routes
      routes = [routes]
    _.each routes, (route) ->
      types = routeInfo.type || 'get'
      if !_.isArray types
        types = [types]
      _.each types, (type) ->
        method = type.toLowerCase()
        app[method] route, middleware, handle
###*
 * renderResponse render模板
 * @param  {[type]}   req           [description]
 * @param  {[type]}   res           [description]
 * @param  {[type]}   template      [description]
 * @param  {[type]}   data          [description]
 * @param  {[type]}   headerOptions [description]
 * @param  {Function} next          [description]
 * @return {[type]}                 [description]
###
renderResponse = (req, res, template, data, headerOptions, next) ->
  fileImporter = data.fileImporter || res.locals?.fileImporter
  res.render template, data, (err, html) =>
    if err
      next err
      return 
    if fileImporter
      html = appendJsAndCss html, fileImporter
      fileImporter.emit 'export', template, {
        jsList : fileImporter.getFiles 'js'
        cssList : fileImporter.getFiles 'css'
      }
    _.defaults headerOptions, {
      'Content-Type' :'text/html'
    }
    response req, res, html, headerOptions, next

###*
 * response 响应请求
 * @param  {request} req request
 * @param  {response} res response
 * @param  {Object, String, Buffer} data 响应的数据
 * @param  {Object} headerOptions 响应的头部
 * @return {[type]}               [description]
###
response = (req, res, data, headerOptions, next) ->
  if resIsAvailable res
    _.defaults headerOptions, {
      'Content-Type' :'text/plain'
    }

    if headerOptions
      _.each headerOptions, (value, key) ->
        res.header key ,value
    res.send data
  else
    err = new Error 'the header has been sent!'
    err.msg = '该请求已发送' 
    next err
###*
 * jsonResponse 响应json
 * @param  {[type]}   req           [description]
 * @param  {[type]}   res           [description]
 * @param  {[type]}   data          [description]
 * @param  {[type]}   headerOptions [description]
 * @param  {Function} next          [description]
 * @return {[type]}                 [description]
###
jsonResponse = (req, res, data, headerOptions, next) ->
  if resIsAvailable res
    _.defaults headerOptions, {
      'Content-Type' :'application/json'
    }
    if headerOptions
      _.each headerOptions, (value, key) ->
        res.header key ,value
    keys = req.query?._key
    if keys
      keys = keys.split ','
      if _.isArray data
        data = _.map data, (item) ->
          _.pick item, keys
      else
        data = _.pick data, keys
    res.json 200, data
  else
    err = new Error 'the header has been sent!'
    err.msg = '该请求已发送' 
    next err

###*
 * appendJsAndCss 往HTML中插入js,css引入列表
 * @param  {String} html html内容（未包含通过FileImporter引入的js,css）
 * @param  {FileImporter} fileImporter FileImporter实例
 * @return {String} 已添加js,css的html
###
appendJsAndCss = (html, fileImporter) ->
  isProductionMode = process.env.NODE_ENV == 'production'
  html = html.replace '<!--CSS_FILES_CONTAINER-->', fileImporter.exportCss isProductionMode
  html = html.replace '<!--JS_FILES_CONTAINER-->', fileImporter.exportJs isProductionMode

###*
   * resIsAvailable 判断response是否可用
   * @param  {response} res response对象
   * @return {Boolean}
  ###
resIsAvailable = (res) ->
  !res.headerSent

###*
 * removeSession 对无变化的session不保存到数据库（不建议使用，因为如果不保存需要另外处理ttl）
 * @param  {[type]} req [description]
 * @return {[type]}     [description]
###
removeSession = (req) ->
  sess = req.session
  _jtSessionTag = req._jtSessionTag
  if _jtSessionTag && sess
    console.dir _jtSessionTag.id == sess.id && _jtSessionTag.crc32 == hash sess
    req.session = null if _jtSessionTag.id == sess.id && _jtSessionTag.crc32 == hash sess