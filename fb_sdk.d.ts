
//68微代理的sdk，使用这个就不需要使用FBInstant的sdk了
//具体用法参考：http://sdk.fb.h5haha.com/doc/#index.md

declare const FBInstant

declare const PLAY68_SDK: {
	debug: boolean

	appId: number

	init(callback:(status: boolean, player: object)=>void)

	//设置资源加载进度。必须init之后才能调用，参数取值范围为0-100
	setLoadingProgress(val: number)

	//必须init之后才能调用 必须start之后才能调用其它
	start(callback:(status: boolean, player: object)=>void)

	//分享加载比较慢，建议分享过程中加载loading效果，回调后关闭loading
	//分享可以附加数据，比如附加用户数据，其他人启动游戏可以获得分享者的数据。见payload参数。
	//分享成功回调参数为true，分享失败或出错回调参数为false。见回调参数。
	//备注：分享到feed目前获取不到payload数据。
	share(url: string, text: string, callback: (status: boolean, base64: object)=>void, 
		payload: object)

	//分享 base64
	//提示：如果图像不支持跨域，需要自行base64编码后使用此api分享
	shareBase64(base64Image: string, text: string, callback: (status: boolean, base64: object)=>void, 
		payload: object)

	//返回与启动游戏的入口点相关的任何数据 对象。
	//注意：此方法须在PLAY68_SDK.start之后调用
	getEntryPointData()

	//从指定的云存储中检索当前玩家的数据
	//keys ['key1', 'key2']
	//data {"key1":"value1", "key2":[1, 2, 3]}
	getDataAsync(keys: any[], callback: (status: boolean, data: object)=>void)

	//设置要保存到指定云存储的当前玩家 的数据。对于每个独立玩家，游戏最多可存储 1MB 的数据。
	//data {"key1":"value1", "key2":[1, 2, 3]}
	setDataAsync(data: object, callback: (status: boolean, data: object)=>void)

	//从指定的云存储中检索当前玩家的统计
	//keys ['key1', 'key2']
	//data {"key1":1, "key2":-1}
	getStatsAsync(keys: any[], callback: (status: boolean, data: object)=>void)

	//设置要保存到指定云存储的当前玩家 的统计。
	//data {"key1":1, "key2":-1} 应该保存到云存储的一组键值对，值只能为整数，非整数拒绝保存。
	setStatsAsync(data: object, callback: (status: boolean, data: object)=>void)

	//更新当前玩家的指定云存储中保存的统计信息。
	//data {"key1":1, "key2":-1} 更新云存储的一组键值对，值只能为整数，非整数拒绝保存。正数为增加，负数为减少。	
	incrementStatsAsync(data: object, callback: (status: boolean, data: object)=>void)

	//获取这款小游戏中的特有排行榜的一些信息
	//name 排行榜的名称。小游戏的每个 排行榜必须具有唯一的名称
	getLeaderBoardInfoV2(name: string, callback: (status: boolean, data: object)=>void)

	//更新玩家的分数。如果玩家已有分数， 只有新分数更好时，才会替换旧分数。
	//name 排行榜的名称。小游戏的每个 排行榜必须具有唯一的名称
	//score 必须为 64 位 整数。
	//extraData 与保存的分数关联的元数据。 大小必须小于 2KB。
	setScoreAsyncV2(name: string, score: number, extraData: string, 
		callback: (status: boolean, data: object)=>void)

	//检索当前玩家的排行榜上榜分数，或在玩家尚无 上榜分数时返回 null。
	//name 排行榜的名称。小游戏的每个 排行榜必须具有唯一的名称
	getPlayerEntryAsyncV2(name: string, callback: (status: boolean, data: object)=>void)

	//检索一组排行榜上榜分数，按排行榜上的得分名次 排序。
	//name 排行榜的名称。小游戏的每个 排行榜必须具有唯一的名称
	//count	尝试从排行榜获取的上榜分数 总数量。如果未指定，默认为 10。每条查询命令最多可获取 100 个上榜分数。
	//offset 从排行榜顶部检索 上榜分数的偏移量
	getEntriesAsyncV2(name: string, count: number, offset: number, 
		callback: (status: boolean, data: any[])=>void)

	//检索当前玩家的连线玩家（包括当前玩家）的排行榜得分条目，按当地排名在连接玩家集内排序。
	getConnectedPlayerEntriesAsyncV2(name: string, count: number, offset: number, 
		callback: (status: boolean, data: any[])=>void)

	//检测当前环境是否支持广告（不传参则检测插屏广告和视频广告同时支持）
	//funcName getInterstitialAdAsync插屏广告 或者 getRewardedVideoAsync视频广告
	isSupportAd(funcName: string): boolean

	//尝试创建插屏广告对象
	//placementID 在 Audience Network 设置中设置的 版位编号
	getInterstitialAdAsync(placementID, callback: (status: boolean, adObject: object)=>void)

	//尝试创建奖励式视频广告对象
	getRewardedVideoAsync(placementID, callback: (status: boolean, adObject: object)=>void)

	//显示/播放广告
	showAsync(adObject: object, callback: (status: boolean, adObject: object)=>void)

	//获取context信息。
	getContextInfo(): any

	//请求切换到指定环境
	//id 目标环境的编号
	switchAsync(id: string, callback: (status: boolean, context: any)=>void)

	//为玩家打开一个环境选择对话框。(打开 拉好友一起玩 对话框)
	//options {filters:适用于环境推荐的一组筛选条件, maxSize:最大玩家数量, minSize:最小玩家数量}
	chooseAsync(options, callback: (status: boolean, context: any)=>void)

	//尝试在指定玩家和当前玩家之间创建环境或 切换环境。
	createAsync(id: string, callback: (status: boolean, context: any)=>void)

	//获取 当前环境player 对象的数组
	getPlayersAsync(callback: (status: boolean, players: [])=>void)

	//提取 ConnectedPlayer 对象的数组
	getConnectedPlayersAsync(callback: (status: boolean, players: [])=>void)

	//通知游戏内发生的更新，一般用来在双人环境中向对方发送消息用。
	updateAsync(payload: object, callback: (status: boolean, context: any)=>void)

	//提示用户创建游戏的快捷方式，如果他们符合条件只能在每个会话中调用一次。
	createShortcutAsync(callback: (res: boolean, error: any)=>void)

	//用户签名验证，验证用户确实来自 SDK，且没有被篡改。
	getSignedPlayerInfoAsync(callback: (res: object)=>void, payload: string)

	//FB平台无此方法，请自行判断。
	//交叉推广相关接口（APP专用）
	getPromotionAsync(platform: string, callback: (res: bool, data: object)=>void)

	//用户点击交叉推广界面，跳转到相关商店
	openMarket(packageName: string, callback: (res: bool, data: null)=>void)	

	//当前的语言设置
	getLocale(): string

	//当前运行游戏的平台
	getPlatform(): string

	//获得SDK 版本号
	getSDKVersion(): string

	//获取player信息
	getPlayerInfo(): object

	//切换同一商务平台的其他游戏
	switchGameAsync(appId: string, payload: object)

	//退出游戏
	quit()

	//设置在触发暂停事件时触发的回调
	onPause(callback: ()=>void)

	//使用FB Analytics记录应用程序事件
	logEvent(eventName: string, valueToSum?: number, parameters?: object)

	//获取当前游戏的发行方
	getPublish()
}
