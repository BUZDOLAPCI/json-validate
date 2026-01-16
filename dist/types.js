/**
 * Helper function to create success response
 */
export function createSuccessResponse(data, options) {
    return {
        ok: true,
        data,
        meta: {
            source: options?.source,
            retrieved_at: new Date().toISOString(),
            pagination: { next_cursor: null },
            warnings: options?.warnings ?? []
        }
    };
}
/**
 * Helper function to create error response
 */
export function createErrorResponse(code, message, details) {
    return {
        ok: false,
        error: {
            code,
            message,
            details
        },
        meta: {
            retrieved_at: new Date().toISOString()
        }
    };
}
//# sourceMappingURL=types.js.map