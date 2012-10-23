ProcessQ
=========

A (pre)process-queue ( e.g resource-loader ) implementation  for Web App. 

ProcessQ 是一个用于WebApp (如HTML5 game)的"预处理动作队列".

###何为"预处理动作队列"?
在WebApp启动前,通常我们会有一些预处理工作要执行. 下面拿游戏举例说明:

为了保证游戏后续运行和显示可以正常且流程的进行, 在游戏启动前, 我们会预先加载游戏中的图片,音乐等资源.
为了处理这类资源加载工作, 通常我们会写一个Loader工具类(或函数) 来帮忙简化这些操作. 同时加入 onLoading onLoaded一类的hook方法来实现对加载过程的监听.

对于大多数开发人员来说,这没什么难度,使用new Image() new Audio(),再配合onload一类的dom事件便可以轻松的实现.
 

然后, 在实际应用中, 除了加载资源文件之外,我们可能还会有一些更复杂的预处理工作要进行,如: 提前算游戏中需要的一些数据(避免运行时计算带来的性能损耗), 从本地或远程加载游戏的配置信息, 检测用户运行环境等等.

这些工作本质上不属于 Loader的范畴, 但是如果对 资源加载和其他预处理工作进行一个抽象, 我们不难发现, 他们的本质其实都是一样的: 在应用正式开始前,做一些事情. 这些事情包括: 加载图片, 加载声音,执行一些其他的函数等等, 即,资源加载只是诸多预处理中的一种.

所以,从这个角度出发, 我封装了这样一个实现, 它不在乎具体的预处理操作是什么,只要每一个操作提供了必须的方法(start, isFinished), 那么就可以很好的这些操作管理起来.

### 和 PreLoadJS 有何不同?
PreloadJS (https://github.com/CreateJS/PreloadJS/ ) 是非常优秀和知名的加载工具类库.
从功能上来说 ProcessQ和PreloadJS完全等同, 即,PreloadJS能做的事情, ProcessQ也都能做(但可能需要做一些扩展),反之亦然. 其实这是废话啊, 因为两者都可以随意扩充, 外加动态脚本语言,不可能存在A能实现,B实现不了的...囧...


PreloadJS 默认情况下 功能比 ProcessQ 更丰富 , 但是很多功能其实并不常用. 而且我个人并不是很喜欢PreLoadJS的抽象方式, 它更倾向于"加载资源"这个概念.

而 ProcessQ 虽然比PreLoadJS功能简单, 但是已经可以胜任绝大多数场景,而且代码和结构更简洁,使用更简单, 扩充也很方便(内部使用duck-type, 只要开发者根据自己的需求实现start和isFinish方法就ok).

当然, 无论是 PreloadJS 还是 ProcessQ , 想真实的得到在时间上 "当前完成工作占用总工作量的百分比"几乎是不可能的, 所以不应该强求"进度条"和真实时间的匹配度.

### example 

	var queue=new ProcessQ({

		items : [
			{ start:function(){ console.log("run "+this.id+" process.") }},
			{ type : "img" , id : "ha-1", src:"./res/ha-1.png"},
			{ type : "audio" , id : "bgm-1", src:"./res/bgm-1"},
		],
		onProgressing : function(deltaTime,queue){
			console.log( "progressing" , queue.finishedWeight," of ",queue.totalWeight);
		},
		onFinish : function(queue){
			console.log("finished : " , queue.finishedCount );
		}
	});
	queue.init();
	queue.start();


### 更多功能和用法详见 example 下的示例 和源码.


关于 weight , delay 等属性的设置和作用详见示例中的注释 和 源码.
我英文很搓, 大家领会精神吧. 






.


.



