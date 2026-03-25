<template>
  <div ref="containerRef" :class="[glassSurfaceClasses, focusVisibleClasses, className]" :style="containerStyles">
    <svg class="w-full h-full pointer-events-none absolute inset-0 opacity-0 -z-10" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter :id="filterId" color-interpolation-filters="sRGB" x="0%" y="0%" width="100%" height="100%">
          <feImage ref="feImageRef" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />

          <feDisplacementMap ref="redChannelRef" in="SourceGraphic" in2="map" id="redchannel" result="dispRed" />
          <feColorMatrix
            in="dispRed"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="red"
          />

          <feDisplacementMap ref="greenChannelRef" in="SourceGraphic" in2="map" id="greenchannel" result="dispGreen" />
          <feColorMatrix
            in="dispGreen"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="green"
          />

          <feDisplacementMap ref="blueChannelRef" in="SourceGraphic" in2="map" id="bluechannel" result="dispBlue" />
          <feColorMatrix
            in="dispBlue"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="blue"
          />

          <feBlend in="red" in2="green" mode="screen" result="rg" />
          <feBlend in="rg" in2="blue" mode="screen" result="output" />
          <feGaussianBlur ref="gaussianBlurRef" in="output" stdDeviation="0.7" />
        </filter>
      </defs>
    </svg>

    <div
      :class="
        contentLayout === 'fill'
          ? 'w-full h-full min-h-0 flex flex-col rounded-[inherit] relative z-10 p-0'
          : 'w-full h-full flex items-center justify-center p-2 rounded-[inherit] relative z-10'
      "
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type CSSProperties, useTemplateRef, onMounted, computed, watch, nextTick, onUnmounted } from 'vue';

interface GlassSurfaceProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: 'R' | 'G' | 'B';
  yChannel?: 'R' | 'G' | 'B';
  mixBlendMode?:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'color-burn'
    | 'hard-light'
    | 'soft-light'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity'
    | 'plus-darker'
    | 'plus-lighter';
  className?: string;
  style?: CSSProperties;
  /** `fill`: full-area column layout for sidebars and panes. `center`: default padded hero/card. */
  contentLayout?: 'center' | 'fill';
  /** Ocean/teal-tinted chrome (sidenav) — matches jelly-block glass language. */
  tintChrome?: 'none' | 'oceanRail';
}

const props = withDefaults(defineProps<GlassSurfaceProps>(), {
  width: '200px',
  height: '200px',
  borderRadius: 20,
  borderWidth: 0.07,
  brightness: 70,
  opacity: 0.93,
  blur: 11,
  displace: 0.5,
  backgroundOpacity: 0,
  saturation: 1,
  distortionScale: -180,
  redOffset: 0,
  greenOffset: 10,
  blueOffset: 20,
  xChannel: 'R',
  yChannel: 'G',
  mixBlendMode: 'difference',
  className: '',
  style: () => ({}),
  contentLayout: 'center',
  tintChrome: 'none',
});

const isDarkMode = ref(false);
const colorMode = useColorMode();

watch(
  () => colorMode.value,
  (v) => {
    isDarkMode.value = v === 'dark';
  },
  { immediate: true },
);

// Generate unique IDs for SVG elements
const generateUniqueId = () => {
  return Math.random().toString(36).substring(2, 15);
};

const uniqueId = generateUniqueId();
const filterId = `glass-filter-${uniqueId}`;
const redGradId = `red-grad-${uniqueId}`;
const blueGradId = `blue-grad-${uniqueId}`;

const containerRef = useTemplateRef<HTMLDivElement>('containerRef');
const feImageRef = useTemplateRef<SVGSVGElement>('feImageRef');
const redChannelRef = useTemplateRef<SVGSVGElement>('redChannelRef');
const greenChannelRef = useTemplateRef<SVGSVGElement>('greenChannelRef');
const blueChannelRef = useTemplateRef<SVGSVGElement>('blueChannelRef');
const gaussianBlurRef = useTemplateRef<SVGSVGElement>('gaussianBlurRef');

let resizeObserver: ResizeObserver | null = null;

const generateDisplacementMap = () => {
  const rect = containerRef.value?.getBoundingClientRect();
  const actualWidth = rect?.width || 400;
  const actualHeight = rect?.height || 200;
  const edgeSize = Math.min(actualWidth, actualHeight) * (props.borderWidth * 0.5);

  const svgContent = `
      <svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${redGradId}" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="red"/>
          </linearGradient>
          <linearGradient id="${blueGradId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0000"/>
            <stop offset="100%" stop-color="blue"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" fill="black"></rect>
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${props.borderRadius}" fill="url(#${redGradId})" />
        <rect x="0" y="0" width="${actualWidth}" height="${actualHeight}" rx="${props.borderRadius}" fill="url(#${blueGradId})" style="mix-blend-mode: ${props.mixBlendMode}" />
        <rect x="${edgeSize}" y="${edgeSize}" width="${actualWidth - edgeSize * 2}" height="${actualHeight - edgeSize * 2}" rx="${props.borderRadius}" fill="hsl(0 0% ${props.brightness}% / ${props.opacity})" style="filter:blur(${props.blur}px)" />
      </svg>
    `;

  return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
};

const updateDisplacementMap = () => {
  if (feImageRef.value) {
    feImageRef.value.setAttribute('href', generateDisplacementMap());
  }
};

const supportsSVGFilters = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const isWebkit = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);

  if (isWebkit || isFirefox) {
    return false;
  }

  const div = document.createElement('div');
  div.style.backdropFilter = `url(#${filterId})`;
  return div.style.backdropFilter !== '';
};

const supportsBackdropFilter = () => {
  if (typeof window === 'undefined') return false;
  return CSS.supports('backdrop-filter', 'blur(10px)');
};

const containerStyles = computed(() => {
  const baseStyles: Record<string, string | number> = {
    ...props.style,
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
    height: typeof props.height === 'number' ? `${props.height}px` : props.height,
    borderRadius: `${props.borderRadius}px`,
    '--glass-frost': props.backgroundOpacity,
    '--glass-saturation': props.saturation
  };

  const svgSupported = supportsSVGFilters();
  const backdropFilterSupported = supportsBackdropFilter();
  const oceanRail = props.tintChrome === 'oceanRail';

  const svgBackground = () => {
    if (oceanRail) {
      if (isDarkMode.value) {
        return `linear-gradient(
            125deg,
            rgba(45, 212, 191, 0.14) 0%,
            rgba(13, 148, 136, 0.16) 28%,
            rgba(8, 47, 73, 0.42) 52%,
            rgba(3, 12, 28, 0.82) 100%
          ),
          hsl(0 0% 0% / ${Math.max(props.backgroundOpacity, 0.12)})`;
      }
      return `linear-gradient(
          158deg,
          rgba(224, 242, 254, 0.88) 0%,
          rgba(204, 251, 241, 0.72) 42%,
          rgba(186, 230, 253, 0.68) 100%
        ),
        hsl(0 0% 100% / ${Math.max(props.backgroundOpacity, 0.07)})`;
    }
    return isDarkMode.value
      ? `hsl(0 0% 0% / ${props.backgroundOpacity})`
      : `hsl(0 0% 100% / ${props.backgroundOpacity})`;
  };

  const svgBoxShadow = () => {
    if (oceanRail && isDarkMode.value) {
      return `0 0 0 1px rgba(34, 211, 238, 0.18),
        0 0 14px -2px rgba(34, 211, 238, 0.12),
        0 0 2px 1px color-mix(in oklch, white, transparent 72%) inset,
        0 0 10px 4px color-mix(in oklch, white, transparent 88%) inset,
        0px 6px 20px rgba(2, 12, 28, 0.35),
        0px 4px 16px rgba(17, 17, 26, 0.05) inset,
        0px 8px 24px rgba(17, 17, 26, 0.05) inset`;
    }
    if (oceanRail && !isDarkMode.value) {
      return `0 0 0 1px rgba(15, 118, 110, 0.16),
        0 10px 32px -8px rgba(15, 118, 110, 0.18),
        0 0 2px 1px color-mix(in oklch, white, transparent 55%) inset,
        0 0 12px 4px color-mix(in oklch, rgb(125 211 252), transparent 82%) inset,
        0px 4px 16px rgba(15, 118, 110, 0.06),
        0px 4px 16px rgba(17, 17, 26, 0.04) inset,
        0px 8px 24px rgba(17, 17, 26, 0.04) inset`;
    }
    return isDarkMode.value
      ? `0 0 2px 1px color-mix(in oklch, white, transparent 65%) inset,
           0 0 10px 4px color-mix(in oklch, white, transparent 85%) inset,
           0px 4px 16px rgba(17, 17, 26, 0.05),
           0px 8px 24px rgba(17, 17, 26, 0.05),
           0px 16px 56px rgba(17, 17, 26, 0.05),
           0px 4px 16px rgba(17, 17, 26, 0.05) inset,
           0px 8px 24px rgba(17, 17, 26, 0.05) inset,
           0px 16px 56px rgba(17, 17, 26, 0.05) inset`
      : `0 0 2px 1px color-mix(in oklch, black, transparent 85%) inset,
           0 0 10px 4px color-mix(in oklch, black, transparent 90%) inset,
           0px 4px 16px rgba(17, 17, 26, 0.05),
           0px 8px 24px rgba(17, 17, 26, 0.05),
           0px 16px 56px rgba(17, 17, 26, 0.05),
           0px 4px 16px rgba(17, 17, 26, 0.05) inset,
           0px 8px 24px rgba(17, 17, 26, 0.05) inset,
           0px 16px 56px rgba(17, 17, 26, 0.05) inset`;
  };

  if (svgSupported) {
    return {
      ...baseStyles,
      background: svgBackground(),
      backdropFilter: `url(#${filterId}) saturate(${props.saturation})`,
      boxShadow: svgBoxShadow()
    };
  } else {
    const heavyFrost = props.backgroundOpacity >= 0.35;
    const frostBlurPx = 14 + props.blur * 0.45;

    if (isDarkMode.value) {
      if (!backdropFilterSupported) {
        return {
          ...baseStyles,
          background: heavyFrost
            ? `rgba(4, 16, 32, ${0.78 + props.backgroundOpacity * 0.12})`
            : oceanRail
              ? 'rgba(4, 18, 36, 0.88)'
              : 'rgba(0, 0, 0, 0.4)',
          border: heavyFrost || oceanRail
            ? '1px solid rgba(34, 211, 238, 0.22)'
            : '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: heavyFrost
            ? `inset 0 1px 0 0 rgba(255, 255, 255, 0.1),
                inset 0 -1px 0 0 rgba(0, 0, 0, 0.35)`
            : oceanRail
              ? `inset 0 1px 0 0 rgba(34, 211, 238, 0.12),
                  inset 0 -1px 0 0 rgba(0, 0, 0, 0.45)`
              : `inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
                      inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)`
        };
      }
      if (heavyFrost) {
        const a = Math.min(0.9, 0.48 + props.backgroundOpacity * 0.38);
        return {
          ...baseStyles,
          background: `rgba(4, 18, 34, ${a})`,
          backdropFilter: `blur(${frostBlurPx}px) saturate(1.35) brightness(0.97)`,
          WebkitBackdropFilter: `blur(${frostBlurPx}px) saturate(1.35) brightness(0.97)`,
          border: '1px solid rgba(34, 211, 238, 0.22)',
          boxShadow: `inset 0 1px 0 0 rgba(255, 255, 255, 0.12),
                      inset 0 -1px 0 0 rgba(0, 0, 0, 0.35)`
        };
      }
      return {
        ...baseStyles,
        background: oceanRail
          ? 'linear-gradient(125deg, rgba(34, 211, 238, 0.1) 0%, rgba(8, 47, 73, 0.45) 45%, rgba(4, 16, 32, 0.72) 100%)'
          : 'rgba(255, 255, 255, 0.1)',
        backdropFilter: oceanRail
          ? 'blur(14px) saturate(1.45) brightness(1.05)'
          : 'blur(12px) saturate(1.8) brightness(1.2)',
        WebkitBackdropFilter: oceanRail
          ? 'blur(14px) saturate(1.45) brightness(1.05)'
          : 'blur(12px) saturate(1.8) brightness(1.2)',
        border: oceanRail ? '1px solid rgba(34, 211, 238, 0.2)' : '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: oceanRail
          ? `inset 0 1px 0 0 rgba(34, 211, 238, 0.14),
              inset 0 -1px 0 0 rgba(0, 0, 0, 0.4)`
          : `inset 0 1px 0 0 rgba(255, 255, 255, 0.2),
                    inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)`
      };
    }

    if (!backdropFilterSupported) {
      return {
        ...baseStyles,
        background: heavyFrost
          ? `rgba(248, 252, 252, ${0.62 + props.backgroundOpacity * 0.2})`
          : oceanRail
            ? 'rgba(224, 242, 254, 0.92)'
            : 'rgba(255, 255, 255, 0.4)',
        border: oceanRail ? '1px solid rgba(15, 118, 110, 0.22)' : '1px solid rgba(255, 255, 255, 0.35)',
        boxShadow: oceanRail
          ? `inset 0 1px 0 0 rgba(255, 255, 255, 0.75),
              inset 0 -1px 0 0 rgba(15, 118, 110, 0.08)`
          : `inset 0 1px 0 0 rgba(255, 255, 255, 0.55),
                    inset 0 -1px 0 0 rgba(255, 255, 255, 0.25)`
      };
    }
    if (heavyFrost) {
      const a = Math.min(0.92, 0.52 + props.backgroundOpacity * 0.28);
      return {
        ...baseStyles,
        background: `rgba(252, 253, 254, ${a})`,
        backdropFilter: `blur(${frostBlurPx}px) saturate(1.45) brightness(1.02)`,
        WebkitBackdropFilter: `blur(${frostBlurPx}px) saturate(1.45) brightness(1.02)`,
        border: '1px solid rgba(15, 118, 110, 0.18)',
        boxShadow: `0 8px 28px 0 rgba(15, 60, 60, 0.08),
                    inset 0 1px 0 0 rgba(255, 255, 255, 0.65),
                    inset 0 -1px 0 0 rgba(15, 118, 110, 0.06)`
      };
    }
    return {
      ...baseStyles,
      background: oceanRail
        ? 'linear-gradient(160deg, rgba(224, 242, 254, 0.75) 0%, rgba(204, 251, 241, 0.58) 50%, rgba(186, 230, 253, 0.55) 100%)'
        : 'rgba(255, 255, 255, 0.25)',
      backdropFilter: oceanRail
        ? 'blur(14px) saturate(1.65) brightness(1.04)'
        : 'blur(12px) saturate(1.8) brightness(1.1)',
      WebkitBackdropFilter: oceanRail
        ? 'blur(14px) saturate(1.65) brightness(1.04)'
        : 'blur(12px) saturate(1.8) brightness(1.1)',
      border: oceanRail ? '1px solid rgba(15, 118, 110, 0.2)' : '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: oceanRail
        ? `0 8px 28px 0 rgba(15, 118, 110, 0.14),
            0 2px 12px 0 rgba(8, 47, 73, 0.08),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.65),
            inset 0 -1px 0 0 rgba(15, 118, 110, 0.07)`
        : `0 8px 32px 0 rgba(31, 38, 135, 0.2),
                  0 2px 16px 0 rgba(31, 38, 135, 0.1),
                  inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
                  inset 0 -1px 0 0 rgba(255, 255, 255, 0.2)`
    };
  }
});

const glassSurfaceClasses = computed(() =>
  props.contentLayout === 'fill'
    ? 'relative flex flex-col min-h-0 w-full h-full overflow-hidden transition-opacity duration-[260ms] ease-out'
    : 'relative flex items-center justify-center overflow-hidden transition-opacity duration-[260ms] ease-out',
);

const focusVisibleClasses = computed(() => {
  return isDarkMode.value
    ? 'focus-visible:outline-2 focus-visible:outline-[#0A84FF] focus-visible:outline-offset-2'
    : 'focus-visible:outline-2 focus-visible:outline-[#007AFF] focus-visible:outline-offset-2';
});

const updateFilterElements = () => {
  const elements = [
    { ref: redChannelRef, offset: props.redOffset },
    { ref: greenChannelRef, offset: props.greenOffset },
    { ref: blueChannelRef, offset: props.blueOffset }
  ];

  elements.forEach(({ ref, offset }) => {
    if (ref.value) {
      ref.value.setAttribute('scale', (props.distortionScale + offset).toString());
      ref.value.setAttribute('xChannelSelector', props.xChannel);
      ref.value.setAttribute('yChannelSelector', props.yChannel);
    }
  });

  if (gaussianBlurRef.value) {
    gaussianBlurRef.value.setAttribute('stdDeviation', props.displace.toString());
  }
};

const setupResizeObserver = () => {
  if (!containerRef.value || typeof ResizeObserver === 'undefined') return;

  resizeObserver = new ResizeObserver(() => {
    setTimeout(updateDisplacementMap, 0);
  });

  resizeObserver.observe(containerRef.value);
};

watch(
  [
    () => props.width,
    () => props.height,
    () => props.borderRadius,
    () => props.borderWidth,
    () => props.brightness,
    () => props.opacity,
    () => props.blur,
    () => props.displace,
    () => props.distortionScale,
    () => props.redOffset,
    () => props.greenOffset,
    () => props.blueOffset,
    () => props.xChannel,
    () => props.yChannel,
    () => props.mixBlendMode
  ],
  () => {
    updateDisplacementMap();
    updateFilterElements();
  }
);

watch([() => props.width, () => props.height], () => {
  setTimeout(updateDisplacementMap, 0);
});

onMounted(() => {
  nextTick(() => {
    updateDisplacementMap();
    updateFilterElements();
    setupResizeObserver();
  });
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});
</script>
