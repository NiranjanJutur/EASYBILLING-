/**
 * GradientView — safe wrapper around react-native-linear-gradient.
 * Falls back to a solid mid-color if the native package is not installed.
 * Usage:
 *   <GradientView colors={GRADIENTS.PRIMARY} style={styles.header}>
 *     <Text>Hello</Text>
 *   </GradientView>
 */
import React from 'react';
import { View, ViewStyle } from 'react-native';

let _LinearGradient: any = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _LinearGradient = require('react-native-linear-gradient').default;
} catch {
    // Package not installed — fallback renders a solid background
}

interface GradientViewProps {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    locations?: number[];
    style?: ViewStyle | ViewStyle[] | any;
    children?: React.ReactNode;
    [key: string]: any;
}

const GradientView: React.FC<GradientViewProps> = ({
    colors,
    start = { x: 0, y: 0 },
    end = { x: 0, y: 1 },
    locations,
    style,
    children,
    ...rest
}) => {
    if (_LinearGradient) {
        return (
            <_LinearGradient
                colors={colors}
                start={start}
                end={end}
                locations={locations}
                style={style}
                {...rest}
            >
                {children}
            </_LinearGradient>
        );
    }
    // Fallback: use the middle color for the richest visual match
    const fallback = colors[Math.floor(colors.length / 2)] ?? colors[0] ?? '#1A6B3C';
    return (
        <View style={[style, { backgroundColor: fallback }]} {...rest}>
            {children}
        </View>
    );
};

export default GradientView;
