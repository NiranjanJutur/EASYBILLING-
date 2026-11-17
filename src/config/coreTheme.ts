/**
 * theme.ts ΓÇö Unified App Design System
 * Single source of truth for ALL screens (native + web).
 * Every colour, spacing, radius, font size and shadow is defined here.
 * NEVER hardcode hex values in screens ΓÇö always import from this file.
 */

// ΓöÇΓöÇ Brand Palette ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export const COLORS = {
    // Default ShopLedger forest green
    PRIMARY:        '#1E6B3C',   // Primary action / tab active / headers
    PRIMARY_LIGHT:  '#27A85A',   // Hover / lighter tint
    PRIMARY_DARK:   '#134D2A',   // Pressed state
    PRIMARY_BG:     '#1E6B3C18', // Transparent tinted background (cards etc.)

    SECONDARY:      '#E8941A',   // Accent orange ΓÇö secondary CTA
    ACCENT:         '#FF6F00',   // Amber ΓÇö udhaar / warnings

    // Semantic
    SUCCESS:        '#1E8449',
    SUCCESS_BG:     '#1E844915',
    WARNING:        '#D4AC0D',
    WARNING_BG:     '#D4AC0D18',
    ERROR:          '#C0392B',
    ERROR_BG:       '#C0392B15',
    INFO:           '#1A6FA8',
    INFO_BG:        '#1A6FA815',

    // Surfaces
    BACKGROUND:     '#F2F5F3',   // App-wide page background (very light greenish grey)
    WHITE:          '#FFFFFF',
    CARD:           '#FFFFFF',
    SURFACE:        '#F7FAF8',
    OVERLAY:        'rgba(0,0,0,0.45)',

    // Text
    TEXT_HEADING:   '#14291E',   // Very dark green-black
    TEXT_BODY:      '#2D4A3A',   // Body copy
    TEXT_DIM:       '#7A9485',   // Captions and labels
    TEXT_PLACEHOLDER: '#B0C4BA',
    TEXT_ON_PRIMARY: '#FFFFFF',
    TEXT_ON_DARK:   '#FFFFFF',

    // Borders / dividers
    BORDER:         '#D8E4DC',
    DIVIDER:        '#EBF1EE',
    SHADOW:         '#000000',

    // Payment modes
    CASH:           '#1E8449',
    UPI:            '#5B2C9E',
    PAYMENT_CARD:   '#1A6FA8',
    UDHAAR:         '#C0392B',

    // Dark-mode login screen surfaces (slate)
    DARK_BG:        '#0F1D16',   // Login screen background
    DARK_SURFACE:   '#172B20',   // Cards on dark bg
    DARK_BORDER:    '#2B4535',   // Borders on dark bg
    DARK_TEXT:      '#C8E6D5',   // Muted text on dark
    DARK_TEXT_DIM:  '#6B9E7E',   // Secondary text on dark
};

// ΓöÇΓöÇ Spacing (8pt grid) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export const SPACING = {
    XS:  4,
    SM:  8,
    MD:  12,
    LG:  16,
    XL:  24,
    XXL: 32,
    XXXL: 48,
};

// ΓöÇΓöÇ Border Radius ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export const RADIUS = {
    XS:   4,
    SM:   6,
    MD:   10,
    LG:   14,
    XL:   20,
    XXL:  28,
    FULL: 999,
    PILL: 50,
};

// ΓöÇΓöÇ Typography Scale ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export const FONT_SIZE = {
    XS:   11,
    SM:   13,
    MD:   15,
    LG:   17,
    XL:   20,
    XXL:  26,
    HERO: 34,
};

export const FONT_WEIGHT = {
    REGULAR:   '400' as const,
    MEDIUM:    '500' as const,
    SEMIBOLD:  '600' as const,
    BOLD:      '700' as const,
    EXTRABOLD: '800' as const,
    BLACK:     '900' as const,
};

// ΓöÇΓöÇ Shadows ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
export const SHADOW = {
    LIGHT: {
        shadowColor: COLORS.SHADOW,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    MEDIUM: {
        shadowColor: COLORS.SHADOW,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 4,
    },
    STRONG: {
        shadowColor: COLORS.SHADOW,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 8,
    },
    GLOW_GREEN: {
        shadowColor: '#27A85A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
};

// ΓöÇΓöÇ Reusable Component Tokens ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// These are composite styles used across multiple screens.
// Avoids copy-paste of the same style blocks in 15 different StyleSheet.create calls.

export const COMPONENT = {
    // Screen header bar
    HEADER: {
        backgroundColor: COLORS.WHITE,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER,
        paddingHorizontal: SPACING.LG,
        paddingVertical: SPACING.MD,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
    },
    // White card with shadow
    CARD: {
        backgroundColor: COLORS.CARD,
        borderRadius: RADIUS.LG,
        padding: SPACING.MD,
        ...SHADOW.LIGHT,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
    },
    // Section heading
    SECTION_TITLE: {
        fontSize: FONT_SIZE.SM,
        fontWeight: FONT_WEIGHT.BOLD,
        color: COLORS.TEXT_DIM,
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
        paddingHorizontal: SPACING.LG,
        paddingVertical: SPACING.SM,
    },
    // Standard row divider
    DIVIDER: {
        height: 1,
        backgroundColor: COLORS.DIVIDER,
        marginHorizontal: SPACING.LG,
    },
    // Primary button
    BTN_PRIMARY: {
        backgroundColor: COLORS.PRIMARY,
        borderRadius: RADIUS.MD,
        paddingVertical: SPACING.MD,
        alignItems: 'center' as const,
    },
    BTN_PRIMARY_TEXT: {
        color: COLORS.TEXT_ON_PRIMARY,
        fontSize: FONT_SIZE.MD,
        fontWeight: FONT_WEIGHT.BOLD,
    },
    // Secondary / outline button
    BTN_SECONDARY: {
        backgroundColor: COLORS.WHITE,
        borderRadius: RADIUS.MD,
        paddingVertical: SPACING.MD,
        borderWidth: 1,
        borderColor: COLORS.PRIMARY,
        alignItems: 'center' as const,
    },
    BTN_SECONDARY_TEXT: {
        color: COLORS.PRIMARY,
        fontSize: FONT_SIZE.MD,
        fontWeight: FONT_WEIGHT.BOLD,
    },
    // Danger button
    BTN_DANGER: {
        backgroundColor: COLORS.ERROR,
        borderRadius: RADIUS.MD,
        paddingVertical: SPACING.MD,
        alignItems: 'center' as const,
    },
    BTN_DANGER_TEXT: {
        color: COLORS.TEXT_ON_PRIMARY,
        fontSize: FONT_SIZE.MD,
        fontWeight: FONT_WEIGHT.BOLD,
    },
    // Text input
    INPUT: {
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        borderRadius: RADIUS.MD,
        paddingHorizontal: SPACING.MD,
        paddingVertical: SPACING.SM,
        fontSize: FONT_SIZE.MD,
        color: COLORS.TEXT_BODY,
        backgroundColor: COLORS.WHITE,
    },
    INPUT_LABEL: {
        fontSize: FONT_SIZE.SM,
        fontWeight: FONT_WEIGHT.SEMIBOLD,
        color: COLORS.TEXT_BODY,
        marginBottom: SPACING.XS,
    },
    // Bottom tab bar
    TAB_BAR: {
        height: 65,
        paddingBottom: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: COLORS.BORDER,
        backgroundColor: COLORS.WHITE,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
    },
};

export const GRADIENTS = {
    // Brand
    PRIMARY:         ['#0F3D24', '#1A6B3C', '#27A85A'] as string[],
    PRIMARY_BANNER:  ['#0C3321', '#1A6B3C'] as string[],
    PRIMARY_CARD:    ['#1A6B3C', '#27A85A'] as string[],
    PRIMARY_SOFT:    ['#E4F4EC', '#C5E8D5'] as string[],
    PRIMARY_HEADER:  ['#0A2E1A', '#165C35', '#1E7A43'] as string[],

    // Gold / amber
    GOLD:            ['#92400E', '#D97706', '#F59E0B'] as string[],
    GOLD_CARD:       ['#FFFBEB', '#FEF3C7'] as string[],
    GOLD_RICH:       ['#B45309', '#D97706'] as string[],

    // Semantic
    SUCCESS:         ['#065F46', '#059669'] as string[],
    ERROR:           ['#7F1D1D', '#DC2626'] as string[],
    INFO:            ['#1E3A8A', '#2563EB'] as string[],
    WARNING:         ['#78350F', '#D97706'] as string[],
    PURPLE:          ['#4C1D95', '#7C3AED'] as string[],
    TEAL:            ['#134E4A', '#0D9488'] as string[],

    // Dark (login)
    DARK:            ['#0B1A10', '#142218', '#1C3326'] as string[],
    DARK_CARD:       ['#142218', '#1C3326'] as string[],
    DARK_FOREST:     ['#0B1A10', '#1C3326'] as string[], // Explicit named legacy key if used

    // Stat card backgrounds
    STAT_GREEN:      ['#F0FDF4', '#DCFCE7'] as string[],
    STAT_AMBER:      ['#FFFBEB', '#FEF3C7'] as string[],
    STAT_RED:        ['#FFF1F2', '#FFE4E6'] as string[],
    STAT_BLUE:       ['#EFF6FF', '#DBEAFE'] as string[],
    STAT_PURPLE:     ['#FAF5FF', '#F3E8FF'] as string[],
    STAT_TEAL:       ['#F0FDFA', '#CCFBF1'] as string[],

    // Quick action buttons
    QA_BILLING:      ['#2ECC71', '#27AE60'] as string[], // Merged from stash
    QA_STOCK:        ['#3498DB', '#2980B9'] as string[],
    QA_REPORT:       ['#9B59B6', '#8E44AD'] as string[],
    QA_CUSTOMER:     ['#1ABC9C', '#16A085'] as string[],
    QA_BILLS:        ['#F1C40F', '#F39C12'] as string[],

    // Tab bar active
    TAB_ACTIVE:      ['#0F3D24', '#1A6B3C'] as string[],

    // Surface
    SURFACE:         ['#FFFFFF', '#F7FAF8'] as string[],
};
