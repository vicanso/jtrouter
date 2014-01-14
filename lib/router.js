(function() {
  var appendJsAndCss, jsonResponse, removeSession, renderResponse, resIsAvailable, response, _;

  _ = require('underscore');

  /**
   * initRoutes 初始化路由处理
   * @param  {express对象} app   express的实例
   * @param  {Array} routeInfos  路由配置的信息列表
   * @return {[type]}  [description]
  */


  module.exports.initRoutes = function(app, routeInfos) {
    return _.each(routeInfos, function(routeInfo) {
      var handle, middleware, routes;
      handle = function(req, res, next) {
        var cbf;
        next = _.once(next);
        cbf = function(err, renderData, statusCode, headerOptions) {
          var template, tmp;
          if (statusCode == null) {
            statusCode = 200;
          }
          if (headerOptions == null) {
            headerOptions = {};
          }
          if (err) {
            next(err);
            return;
          }
          if (_.isNumber(renderData)) {
            tmp = statusCode;
            statusCode = renderData;
            renderData = tmp;
          }
          if (_.isObject(statusCode)) {
            tmp = statusCode;
            headerOptions = statusCode;
            statusCode = tmp;
          }
          if (!_.isNumber(statusCode)) {
            statusCode = 200;
          }
          if (renderData) {
            template = renderData.template || routeInfo.template;
            res.status(statusCode);
            if (statusCode > 299 && statusCode < 400) {
              return res.redirect(statusCode, renderData);
            } else if (template) {
              res.locals.template = template;
              return renderResponse(req, res, template, renderData, headerOptions, next);
            } else {
              if (_.isObject(renderData)) {
                return jsonResponse(req, res, renderData, headerOptions, next);
              } else {
                return response(req, res, renderData, headerOptions, next);
              }
            }
          } else {
            return res.send(statusCode);
          }
        };
        return routeInfo.handler(req, res, cbf, next);
      };
      middleware = routeInfo.middleware || [];
      routes = routeInfo.route;
      if (!_.isArray(routes)) {
        routes = [routes];
      }
      return _.each(routes, function(route) {
        var types;
        types = routeInfo.type || 'get';
        if (!_.isArray(types)) {
          types = [types];
        }
        return _.each(types, function(type) {
          var method;
          method = type.toLowerCase();
          return app[method](route, middleware, handle);
        });
      });
    });
  };

  /**
   * renderResponse render模板
   * @param  {[type]}   req           [description]
   * @param  {[type]}   res           [description]
   * @param  {[type]}   template      [description]
   * @param  {[type]}   data          [description]
   * @param  {[type]}   headerOptions [description]
   * @param  {Function} next          [description]
   * @return {[type]}                 [description]
  */


  renderResponse = function(req, res, template, data, headerOptions, next) {
    var fileImporter, _ref,
      _this = this;
    fileImporter = data.fileImporter || ((_ref = res.locals) != null ? _ref.fileImporter : void 0);
    fileImporter.addTemplateFiles(template);
    return res.render(template, data, function(err, html) {
      if (err) {
        next(err);
        return;
      }
      if (fileImporter) {
        html = appendJsAndCss(html, fileImporter);
        fileImporter.emit('export', template, {
          jsList: fileImporter.getFiles('js'),
          cssList: fileImporter.getFiles('css')
        });
      }
      _.defaults(headerOptions, {
        'Content-Type': 'text/html'
      });
      return response(req, res, html, headerOptions, next);
    });
  };

  /**
   * response 响应请求
   * @param  {request} req request
   * @param  {response} res response
   * @param  {Object, String, Buffer} data 响应的数据
   * @param  {Object} headerOptions 响应的头部
   * @return {[type]}               [description]
  */


  response = function(req, res, data, headerOptions, next) {
    var err;
    if (resIsAvailable(res)) {
      _.defaults(headerOptions, {
        'Content-Type': 'text/plain'
      });
      if (headerOptions) {
        _.each(headerOptions, function(value, key) {
          return res.header(key, value);
        });
      }
      return res.send(data);
    } else {
      err = new Error('the header has been sent!');
      err.msg = '该请求已发送';
      return next(err);
    }
  };

  /**
   * jsonResponse 响应json
   * @param  {[type]}   req           [description]
   * @param  {[type]}   res           [description]
   * @param  {[type]}   data          [description]
   * @param  {[type]}   headerOptions [description]
   * @param  {Function} next          [description]
   * @return {[type]}                 [description]
  */


  jsonResponse = function(req, res, data, headerOptions, next) {
    var err, keys, _ref;
    if (resIsAvailable(res)) {
      _.defaults(headerOptions, {
        'Content-Type': 'application/json'
      });
      if (headerOptions) {
        _.each(headerOptions, function(value, key) {
          return res.header(key, value);
        });
      }
      keys = (_ref = req.query) != null ? _ref._key : void 0;
      if (keys) {
        keys = keys.split(',');
        if (_.isArray(data)) {
          data = _.map(data, function(item) {
            return _.pick(item, keys);
          });
        } else {
          data = _.pick(data, keys);
        }
      }
      return res.json(200, data);
    } else {
      err = new Error('the header has been sent!');
      err.msg = '该请求已发送';
      return next(err);
    }
  };

  /**
   * appendJsAndCss 往HTML中插入js,css引入列表
   * @param  {String} html html内容（未包含通过FileImporter引入的js,css）
   * @param  {FileImporter} fileImporter FileImporter实例
   * @return {String} 已添加js,css的html
  */


  appendJsAndCss = function(html, fileImporter) {
    var isProductionMode;
    isProductionMode = process.env.NODE_ENV === 'production';
    html = html.replace('<!--CSS_FILES_CONTAINER-->', fileImporter.exportCss(isProductionMode));
    return html = html.replace('<!--JS_FILES_CONTAINER-->', fileImporter.exportJs(isProductionMode));
  };

  /**
     * resIsAvailable 判断response是否可用
     * @param  {response} res response对象
     * @return {Boolean}
  */


  resIsAvailable = function(res) {
    return !res.headerSent;
  };

  /**
   * removeSession 对无变化的session不保存到数据库（不建议使用，因为如果不保存需要另外处理ttl）
   * @param  {[type]} req [description]
   * @return {[type]}     [description]
  */


  removeSession = function(req) {
    var sess, _jtSessionTag;
    sess = req.session;
    _jtSessionTag = req._jtSessionTag;
    if (_jtSessionTag && sess) {
      console.dir(_jtSessionTag.id === sess.id && _jtSessionTag.crc32 === hash(sess));
      if (_jtSessionTag.id === sess.id && _jtSessionTag.crc32 === hash(sess)) {
        return req.session = null;
      }
    }
  };

}).call(this);
