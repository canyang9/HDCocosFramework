'use strict';

var path = require('path');
var fs = require('fs');
var CfgUtil = require('./core/CfgUtil');

var utils = require('./core/utils');
var child_process = require("child_process");
var resPath = '';
var subResPath = '';

var fileList = [];
var subFileList = [];

let bBuildFinish = false

function onBuildStart(options, callback) {
    initPlugin();

    bBuildFinish = false

    callback();
}

function onBeforeChangeFiles(options, callback) {
    if (self.info.flagCompress) {
        resPath = options.dest + "/res/";
		subResPath = options.dest + "/subpackages/";
		
		let resImgArr = []
		let subpackageImgArr = []
        if(utils.checkIsExistProject(resPath)){
            //fileList = utils.loadPngFiles();
            //compressionPng(callback);
			resImgArr = utils.loadPngFiles()
			// Editor.log('11111111111111111');
			// Editor.log(i);
			for(let index in resImgArr){
				fileList.push(resImgArr[index])
			}
			//fileList.concat(i)
        }
		
		if(utils.checkIsExistProject(subResPath)){
			subpackageImgArr = utils.loadPngFiles()
			// Editor.log('22222222222222');
			// Editor.log(ii);
			for(let index in subpackageImgArr){
				fileList.push(subpackageImgArr[index])
			}
            //fileList.concat(i)
        }
		
		// Editor.log('3333333333333');
		// Editor.log(fileList);
		compressionPng(callback);
    } else{
        Editor.log("不执行主包图片压缩");
        callback();
    };
}

function _getTextureFromSpriteFrames (buildResults, assetInfos) {
    let textures = {};
    for (let i = 0; i < assetInfos.length; ++i) {
        let info = assetInfos[i];

        if (buildResults.containsAsset(info.uuid)) {
            let depends = buildResults.getDependencies(info.uuid);
            if (depends.length > 0) {
                // sprite frame should have only one texture
                textures[depends[0]] = true;
            }
        }
    }
    return Object.keys(textures);
}

function compressionPng(callback) {
    Editor.success("pngquant start!")

    let index = 0;
	
    let url = ""
    if (cc.sys.os == "OS X") {
        url = 'packages://build-setting/tool/mac/pngquant';
    } else if (cc.sys.os == "Windows"){
        url = 'packages://build-setting/tool/windows/pngquant';
    };
    let pngquant_path = Editor.url(url);
    let cmd = pngquant_path + " --transbug --force 256 --ext .png";
	
    let item = fileList[index];
	Editor.log('节点路径')
	Editor.log(item)
	
    let exe_cmd = cmd + ' ' + item.path;

    var totalSizeEX = 0;
    var totalSize = 0;

    function exec() {
        child_process.exec(exe_cmd, { timeout: 3654321 }, function (error, stdout, stderr) {
            if (stderr) {
                Editor.error("pngquant error : " + stderr);
                //return;
            }

            let file_path = item.path.replace(resPath, " ");
            let afterSize = getFileState(item.path).size;
            totalSizeEX = totalSizeEX + item.size;
            totalSize = totalSize + afterSize;
            //Editor.log(`[${file_path}] 原始大小:${item.size} B,压缩后大小:${afterSize} B,压缩率:${(afterSize/item.size*100).toFixed(2)}%`);

            if (index < fileList.length - 1) {
                
                index++;
                item = fileList[index];
                exe_cmd = cmd + ' ' + item.path;
                
                exec();
            } else {
                Editor.success("pngquant finished!");
                Editor.log(`主包压缩完成,原始总大小${(totalSizeEX/1000).toFixed(2)}KB:, 压缩后总大小${(totalSize/1000).toFixed(2)}KB:,总压缩率:${(totalSize/totalSizeEX*100).toFixed(2)}%`);
                callback && callback.call();
            }
        });
    }

    exec();
}

function subCompressionPng(callback) {
    Editor.success("pngquant start!")
	Editor.log('压缩子包')
	
    let index = 0;

    let url = ""
    if (cc.sys.os == "OS X") {
        url = 'packages://build-setting/tool/mac/pngquant';
    } else if (cc.sys.os == "Windows"){
        url = 'packages://build-setting/tool/windows/pngquant';
    };
    let pngquant_path = Editor.url(url);
    let cmd = pngquant_path + " --transbug --force 256 --ext .png";

    let item = subFileList[index];
	
    let exe_cmd = cmd + ' ' + item.path;

    var totalSizeEX = 0;
    var totalSize = 0;

    function exec() {
        child_process.exec(exe_cmd, { timeout: 3654321 }, function (error, stdout, stderr) {
            if (stderr) {
                Editor.error("pngquant error : " + stderr);
                //return;
            }

            let file_path = item.path.replace(subFileList, " ");
            let afterSize = getFileState(item.path).size;
            totalSizeEX = totalSizeEX + item.size;
            totalSize = totalSize + afterSize;
             Editor.log(`[${file_path}] 原始大小:${item.size} B,压缩后大小:${afterSize} B,压缩率:${(afterSize/item.size*100).toFixed(2)}%`);

            if (index < fileList.length - 1) {
                
                index++;
                item = fileList[index];
                exe_cmd = cmd + ' ' + item.path;
                
                exec();
            } else {
                Editor.success("pngquant finished!");
                Editor.log(`子包压缩完成,原始总大小${(totalSizeEX/1000).toFixed(2)}KB:, 压缩后总大小${(totalSize/1000).toFixed(2)}KB:,总压缩率:${(totalSize/totalSizeEX*100).toFixed(2)}%`);
                callback && callback.call();
            }
        });
    }

    exec();
}

function getFileState(res_path) {
    return fs.lstatSync(res_path);
}

function fileTraverse(path)
{
    let result = []
    let files = fs.readdirSync(path)
    files.forEach(function (file) {
        let pathname = path + "/" + file 
        let stat = fs.lstatSync(pathname)
        if (stat === undefined) return

        if (!stat.isDirectory()) 
        {
            result.push(pathname)
        } 
        else 
        {
            result = result.concat(fileTraverse(pathname))
        }
    });
    return result
}

function checkInFileArr(name, fileArr)
{
    let ret = -1

    for(let i = 0; i < fileArr.length; ++i)
    {
        if(fileArr[i].indexOf(name) !== -1)
        {
            ret = i
            // fileArr.splice(i, 1)
            break
        }
    }

    return ret
}

function onBeforeBuildFinish (options, callback) {
    if(bBuildFinish)
        return

    Editor.log('self.info.flagDel', self.info.flagDel)

    if(self.info.flagDel)
    {
        let buildResults = options.buildResults;

        let fileArr = fileTraverse(options.dest + '/res/raw-assets')
        Editor.log("fileArr", fileArr)

        let dirArr = []
        if(self.info.targetDir !== '')
            dirArr = self.info.targetDir.split(",")

        Editor.log('dirArr', dirArr)

        let delFunc = function(assetInfos) {
            let textures = _getTextureFromSpriteFrames(buildResults, assetInfos);
            for (let i = 0; i < textures.length; ++i) {
                let path = buildResults.getNativeAssetPath(textures[i]);
                Editor.log('texture of "db://assets/resources/":', textures[i]);

                let idx = checkInFileArr(textures[i], fileArr) 
                if(idx !== -1)
                {
                    let p = fileArr.splice(idx, 1).toString()
                    Editor.log('target texture deleted', p)

                    fs.unlinkSync(p)
                }
            }
        }

        if(dirArr.length > 0)
        {
            for(let i = 0; i < dirArr.length; ++i)
            {
                Editor.log('del dir', dirArr[i])

                Editor.assetdb.queryAssets('db://assets/resources/' + dirArr[i] + '/**/*', 'sprite-frame', (err, assetInfos) => {
                    delFunc(assetInfos)

                    if(i >= dirArr.length - 1)
                        callback()
                });
            }
        }
        else
        {
            Editor.log('default del resources')
            // get path of textures auto generated by auto atlas
            Editor.assetdb.queryAssets('db://assets/resources/**/*', 'sprite-frame', (err, assetInfos) => {
                delFunc(assetInfos)

                callback()
            });
        }

        // get all textures in build
        // let textures = [];
        // let assets = buildResults.getAssetUuids();
        // let textureType = cc.js._getClassId(cc.Texture2D);
        // for (let i = 0; i < assets.length; ++i) {
        //     let asset = assets[i];
        //     if (buildResults.getAssetType(asset) === textureType) {
        //         textures.push(buildResults.getNativeAssetPath(asset));
        //     }
        // }
        // Editor.log('All textures in build:', textures);
    }
    else
    {
        var dest = options.dest.replace(/\\/g,'/');
        var folder = dest.substring(dest.lastIndexOf('/'))+'/';

        function createManifest() {
            if (self.info.flagManifest) {
                addHotUpdateSearchPaths(options.dest);

                //version.txt本身没用,作用在于写入文件后构建完成会重新载入该插件,防止重新构建时报错
                var versionPath = path.resolve(__dirname, 'core/version.txt');
                fs.writeFileSync(versionPath,"version1");

                var Generator = require('./core/version_generator');
                Generator.build(self.info.version, 
                    self.info.packageUrl, 
                    options.buildPath+folder, 
                    options.project+'/assets/',
                    self.info.manifestUUID,
                    function(err,res){
                        Editor.log('热更新资源打包结果:',err?'失败':'成功');
                        if(err){
                            Editor.log('error:',err);
                        }

                        callback() ;
                });
            } else{
                Editor.log("不生成热更文件");
            
                callback();
            };
        }

        if (self.info.flagEncrypt) {
            if(options.platform == 'android' || options.platform == 'ios' || options.platform == 'win32'){

                var callEncode = require('./core/callEncode');
                var scriptPath = options.project + "/packages/build-setting/core/encode.py";

                callEncode.build(scriptPath, options.buildPath+folder+'res', 
                    self.info.encryptPrefix, self.info.encryptKey,
                    function(err,res){
                        Editor.log('图片加密结果:',err?'失败':'成功');
                        if(err){
                            Editor.log('error:',err);
                            callback();
                        } else {
                            createManifest();
                        }
                })

            } else {
                callback();
            }
        } else{
            Editor.log("不执行图片加密");
            createManifest();
        };
    }
    
    bBuildFinish = true
}

function addHotUpdateSearchPaths(dest) {

    var mainJsPath = path.join(dest, 'main.js');
    var script = fs.readFileSync(mainJsPath, 'utf8');

    var newStr =
        "if (jsb) { \n" + 
        "    var hotUpdateSearchPaths = localStorage.getItem('HotUpdateSearchPaths'); \n" +
        "    if (hotUpdateSearchPaths) { \n" + 
        "        jsb.fileUtils.setSearchPaths(JSON.parse(hotUpdateSearchPaths)); \n" + 
        "    }\n" +
        "}\n";
    script = newStr + script;
    fs.writeFileSync(mainJsPath, script);
    Editor.log("添加热更搜索路径成功");
}

function initPlugin() {
    CfgUtil.initCfg(function (data) {
        if (data) {
            self.info.flagCompress = data.isCompress;
            self.info.flagDel = data.isDelete;
            self.info.flagEncrypt = data.isEncrypt;
            self.info.flagManifest = data.isManifest;
            self.info.targetDir = data.targetDir;
            self.info.encryptPrefix = data.encryptPrefix;
            self.info.encryptKey = data.encryptKey;
            self.info.version = data.version;
            self.info.packageUrl = data.packageUrl;
            self.info.manifestUUID = data.manifestUUID;
            Editor.log(self.info);
        }
    }.bind(self));
}

let self = module.exports = {
    load() {
        Editor.Builder.on('build-start', onBuildStart);
        Editor.Builder.on('before-change-files', onBeforeChangeFiles);
        Editor.Builder.on('build-finished', onBeforeBuildFinish);
    },

    unload() {
        Editor.Builder.removeListener('build-start', onBuildStart);
        Editor.Builder.removeListener('before-change-files', onBeforeChangeFiles);
        Editor.Builder.removeListener('build-finished', onBeforeBuildFinish);
    },

    info: {
        flagCompress : true,
        flagDel : false,
        flagEncrypt : false,
        flagManifest : false,
        targetDir : "",
        encryptPrefix : "",
        encryptKey : "",
        version : "",
        packageUrl : "",
        manifestUUID : "",
    },

    // register your ipc messages here
    messages: {
        'open'() {
            // open entry panel registered in package.json
            Editor.Panel.open('build-setting');
        },
        'popup-create-menu'(event, x, y, data) {
            let electron = require('electron');
            let BrowserWindow = electron.BrowserWindow;
            let template = [
                {
                    label: '清空日志', click() {
                    Editor.Ipc.sendToPanel('build-setting', 'build-setting:cleanLog', data);
                }
                },
                // {type: 'separator'},
            ];
            let editorMenu = new Editor.Menu(template, event.sender);

            x = Math.floor(x);
            y = Math.floor(y);
            editorMenu.nativeMenu.popup(BrowserWindow.fromWebContents(event.sender), x, y);
            editorMenu.dispose();
        },
        'builder:query-build-options'(event){
            Editor.Ipc.sendToPanel('build-setting', 'build-setting:queryBuildOptions', event);
        },

        // 'setFlagCompress' (event, flag) {
        //     this.info.flagCompress = flag;
        //     // Editor.log('setFlagCompress:' + flag);
        // },
        // 'setFlagEncrypt' (event, flag) {
        //     this.info.flagEncrypt = flag;
        //     // Editor.log('setFlagEncrypt:' + flag);
        // },
        // 'setFlagManifest' (event, flag) {
        //     this.info.flagManifest = flag;
        //     // Editor.log('setFlagManifest:' + flag);
        // },
        
    },
};