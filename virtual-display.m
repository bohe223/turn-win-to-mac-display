// 在 macOS 上创建一块"虚拟显示器"（扩展屏），供浏览器捕获后推流到 Windows。
// 用的是 CoreGraphics 的私有 API CGVirtualDisplay（DeskPad / BetterDisplay 同款）。
// 编译: clang -fobjc-arc -framework Foundation -framework CoreGraphics virtual-display.m -o virtual-display
// 运行: ./virtual-display 1920 1080 [hidpi]   —— Ctrl+C 退出后虚拟屏自动消失
#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>

@interface CGVirtualDisplayDescriptor : NSObject
@property(retain, nonatomic) dispatch_queue_t queue;
@property(copy, nonatomic) NSString *name;
@property(nonatomic) unsigned int maxPixelsWide;
@property(nonatomic) unsigned int maxPixelsHigh;
@property(nonatomic) CGSize sizeInMillimeters;
@property(nonatomic) unsigned int productID;
@property(nonatomic) unsigned int vendorID;
@property(nonatomic) unsigned int serialNum;
@property(copy, nonatomic) void (^terminationHandler)(id, id);
@end

@interface CGVirtualDisplayMode : NSObject
- (instancetype)initWithWidth:(unsigned int)width height:(unsigned int)height refreshRate:(double)refreshRate;
@end

@interface CGVirtualDisplaySettings : NSObject
@property(nonatomic) unsigned int hiDPI;
@property(retain, nonatomic) NSArray *modes;
@end

@interface CGVirtualDisplay : NSObject
@property(readonly, nonatomic) CGDirectDisplayID displayID;
- (instancetype)initWithDescriptor:(CGVirtualDisplayDescriptor *)descriptor;
- (BOOL)applySettings:(CGVirtualDisplaySettings *)settings;
@end

static CGVirtualDisplay *gDisplay;

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    unsigned int w = argc > 1 ? (unsigned)atoi(argv[1]) : 1920;
    unsigned int h = argc > 2 ? (unsigned)atoi(argv[2]) : 1080;
    BOOL hidpi = argc > 3 && strcmp(argv[3], "hidpi") == 0;

    Class descCls = NSClassFromString(@"CGVirtualDisplayDescriptor");
    Class dispCls = NSClassFromString(@"CGVirtualDisplay");
    Class setCls = NSClassFromString(@"CGVirtualDisplaySettings");
    Class modeCls = NSClassFromString(@"CGVirtualDisplayMode");
    if (!descCls || !dispCls || !setCls || !modeCls) {
      fprintf(stderr, "当前 macOS 不支持 CGVirtualDisplay\n");
      return 1;
    }

    CGVirtualDisplayDescriptor *desc = [[descCls alloc] init];
    desc.queue = dispatch_get_main_queue();
    desc.name = @"Windows Display";
    // hidpi 模式下像素翻倍，逻辑分辨率仍为 w x h
    desc.maxPixelsWide = hidpi ? w * 2 : w;
    desc.maxPixelsHigh = hidpi ? h * 2 : h;
    desc.sizeInMillimeters = CGSizeMake(w * 0.2646, h * 0.2646); // ~96 DPI
    desc.productID = 0x1234;
    desc.vendorID = 0x3456;
    desc.serialNum = 0x0001;
    desc.terminationHandler = ^(id a, id b) { fprintf(stderr, "虚拟显示器已被系统终止\n"); exit(0); };

    gDisplay = [[dispCls alloc] initWithDescriptor:desc];
    if (!gDisplay) { fprintf(stderr, "创建虚拟显示器失败\n"); return 1; }

    CGVirtualDisplaySettings *settings = [[setCls alloc] init];
    settings.hiDPI = hidpi ? 1 : 0;
    settings.modes = @[ [[modeCls alloc] initWithWidth:w height:h refreshRate:60] ];
    if (![gDisplay applySettings:settings]) { fprintf(stderr, "应用显示模式失败\n"); return 1; }

    printf("✅ 虚拟显示器已创建: %ux%u%s (displayID=%u)\n", w, h, hidpi ? " HiDPI" : "", gDisplay.displayID);
    printf("   可在「系统设置 → 显示器」里调整它相对主屏的位置。按 Ctrl+C 移除。\n");
    fflush(stdout);

    signal(SIGINT, SIG_DFL);
    dispatch_main();
  }
}
