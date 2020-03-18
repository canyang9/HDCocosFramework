"use strict";

//全局的版本号，所有需要访问版本号的地方统一从此处获取
window.g_gameVersion = '1.0.0'

//引入天幕SDK，无需接入天幕的项目请注释以下TMSDK注释块包围下的代码
//---------TMSDK----------
if(typeof wx !== 'undefined')
{
	require("./tmsdk/tm_sdk.min") 

	wx.tmSDK.init({
		hideRequestLog: false,
		appVersion: g_gameVersion
	})
}
//---------TMSDK----------

require('adapter-min.js');

__globalAdapter.init();

require('cocos/cocos2d-js-min.js');

require('physics-min.js');

__globalAdapter.adaptEngine();

require('./ccRequire');

require('./src/settings'); // Introduce Cocos Service here


require('./main'); // TODO: move to common
// Adjust devicePixelRatio


cc.view._maxPixelRatio = 4; // downloader polyfill

window.wxDownloader = remoteDownloader; // handle remote downloader

remoteDownloader.REMOTE_SERVER_ROOT = "";
remoteDownloader.SUBCONTEXT_ROOT = "";
var pipeBeforeDownloader = cc.loader.subPackPipe || cc.loader.md5Pipe || cc.loader.assetLoader;
cc.loader.insertPipeAfter(pipeBeforeDownloader, remoteDownloader);

if (cc.sys.platform === cc.sys.WECHAT_GAME_SUB) {
  var SUBDOMAIN_DATA = require('src/subdomain.json.js');

  cc.game.once(cc.game.EVENT_ENGINE_INITED, function () {
    cc.Pipeline.Downloader.PackDownloader._doPreload("SUBDOMAIN_DATA", SUBDOMAIN_DATA);
  });
} else {
  // Release Image objects after uploaded gl texture
  cc.macro.CLEANUP_IMAGE_CACHE = true;
}

remoteDownloader.init();
window.boot();