export const getPercentChange = (current: number, prev: number): number => {
    if (current && prev) {
        const change = ((parseFloat(current.toString()) - parseFloat(prev.toString())) / parseFloat(prev.toString())) * 100;
        if (isFinite(change)) return change;
    }
    return 0;
};
