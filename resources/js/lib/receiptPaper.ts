export type Point = { x: number; y: number };

export type Raster = {
    data: Uint8ClampedArray;
    width: number;
    height: number;
};

export type PaperGuide = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type PaperFind = {
    corners: [Point, Point, Point, Point];
    framed: boolean;
};

const grayOf = (data: Uint8ClampedArray, index: number) =>
    Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);

function boxBlur(source: Uint8Array, width: number, height: number, radius: number) {
    const horizontal = new Uint8Array(source.length);
    const output = new Uint8Array(source.length);
    const window = radius * 2 + 1;

    for (let y = 0; y < height; y++) {
        let sum = 0;

        for (let x = -radius; x <= radius; x++) {
            sum += source[y * width + Math.min(width - 1, Math.max(0, x))];
        }

        for (let x = 0; x < width; x++) {
            horizontal[y * width + x] = Math.round(sum / window);
            const leave = x - radius;
            const enter = x + radius + 1;
            sum -= source[y * width + Math.min(width - 1, Math.max(0, leave))];
            sum += source[y * width + Math.min(width - 1, Math.max(0, enter))];
        }
    }

    for (let x = 0; x < width; x++) {
        let sum = 0;

        for (let y = -radius; y <= radius; y++) {
            sum += horizontal[Math.min(height - 1, Math.max(0, y)) * width + x];
        }

        for (let y = 0; y < height; y++) {
            output[y * width + x] = Math.round(sum / window);
            const leave = y - radius;
            const enter = y + radius + 1;
            sum -= horizontal[Math.min(height - 1, Math.max(0, leave)) * width + x];
            sum += horizontal[Math.min(height - 1, Math.max(0, enter)) * width + x];
        }
    }

    return output;
}

function otsu(gray: Uint8Array) {
    const histogram = new Uint32Array(256);

    for (const value of gray) {
        histogram[value] += 1;
    }

    const total = gray.length;
    let sum = 0;

    for (let tone = 0; tone < 256; tone++) {
        sum += tone * histogram[tone];
    }

    let backgroundWeight = 0;
    let backgroundSum = 0;
    let best = 0;
    let threshold = 127;

    for (let tone = 0; tone < 256; tone++) {
        backgroundWeight += histogram[tone];

        if (backgroundWeight === 0) {
            continue;
        }

        const foregroundWeight = total - backgroundWeight;

        if (foregroundWeight === 0) {
            break;
        }

        backgroundSum += tone * histogram[tone];
        const backgroundMean = backgroundSum / backgroundWeight;
        const foregroundMean = (sum - backgroundSum) / foregroundWeight;
        const score = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;

        if (score > best) {
            best = score;
            threshold = tone;
        }
    }

    return threshold;
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number) {
    const output = new Uint8Array(mask.length);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x] === 0) {
                continue;
            }

            const y0 = Math.max(0, y - radius);
            const y1 = Math.min(height - 1, y + radius);
            const x0 = Math.max(0, x - radius);
            const x1 = Math.min(width - 1, x + radius);

            for (let ny = y0; ny <= y1; ny++) {
                for (let nx = x0; nx <= x1; nx++) {
                    output[ny * width + nx] = 1;
                }
            }
        }
    }

    return output;
}

function exterior(mask: Uint8Array, width: number, height: number) {
    const outside = new Uint8Array(mask.length);
    const stack: number[] = [];
    const push = (index: number) => {
        if (outside[index] === 1 || mask[index] === 1) {
            return;
        }

        outside[index] = 1;
        stack.push(index);
    };

    for (let x = 0; x < width; x++) {
        push(x);
        push((height - 1) * width + x);
    }

    for (let y = 0; y < height; y++) {
        push(y * width);
        push(y * width + width - 1);
    }

    while (stack.length > 0) {
        const index = stack.pop() as number;
        const x = index % width;
        const y = Math.floor(index / width);

        if (x > 0) {
            push(index - 1);
        }

        if (x < width - 1) {
            push(index + 1);
        }

        if (y > 0) {
            push(index - width);
        }

        if (y < height - 1) {
            push(index + width);
        }
    }

    return outside;
}

function convexHull(points: Point[]) {
    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const unique: Point[] = [];

    for (const point of sorted) {
        const last = unique[unique.length - 1];

        if (!last || last.x !== point.x || last.y !== point.y) {
            unique.push(point);
        }
    }

    if (unique.length < 4) {
        return unique;
    }

    const cross = (origin: Point, a: Point, b: Point) =>
        (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
    const build = (source: Point[]) => {
        const hull: Point[] = [];

        for (const point of source) {
            while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
                hull.pop();
            }

            hull.push(point);
        }

        return hull;
    };
    const lower = build(unique);
    const upper = build([...unique].reverse());

    lower.pop();
    upper.pop();

    return [...lower, ...upper];
}

function fourCorners(hull: Point[]): [Point, Point, Point, Point] | null {
    if (hull.length < 4) {
        return null;
    }

    let topLeft = hull[0];
    let topRight = hull[0];
    let bottomRight = hull[0];
    let bottomLeft = hull[0];

    for (const point of hull) {
        if (point.x + point.y < topLeft.x + topLeft.y) {
            topLeft = point;
        }

        if (point.x - point.y > topRight.x - topRight.y) {
            topRight = point;
        }

        if (point.x + point.y > bottomRight.x + bottomRight.y) {
            bottomRight = point;
        }

        if (point.y - point.x > bottomLeft.y - bottomLeft.x) {
            bottomLeft = point;
        }
    }

    const corners: [Point, Point, Point, Point] = [topLeft, topRight, bottomRight, bottomLeft];
    const keys = new Set(corners.map((point) => `${point.x},${point.y}`));

    return keys.size === 4 ? corners : null;
}

function quadArea(corners: Point[]) {
    let area = 0;

    for (let index = 0; index < corners.length; index++) {
        const current = corners[index];
        const next = corners[(index + 1) % corners.length];
        area += current.x * next.y - next.x * current.y;
    }

    return Math.abs(area) / 2;
}

function insideGuide(corners: Point[], guide: PaperGuide) {
    const pad = Math.min(guide.width, guide.height) * 0.04;

    return corners.every((point) =>
        point.x >= guide.x - pad
        && point.y >= guide.y - pad
        && point.x <= guide.x + guide.width + pad
        && point.y <= guide.y + guide.height + pad,
    );
}

export function findReceiptPaper(image: Raster, guide: PaperGuide): PaperFind | null {
    const { width, height, data } = image;

    if (width < 20 || height < 20) {
        return null;
    }

    const gray = new Uint8Array(width * height);

    for (let index = 0; index < gray.length; index++) {
        gray[index] = grayOf(data, index * 4);
    }

    const blurred = boxBlur(gray, width, height, 2);
    const threshold = otsu(blurred);
    const bright = new Uint8Array(blurred.length);

    for (let index = 0; index < blurred.length; index++) {
        bright[index] = blurred[index] >= threshold ? 1 : 0;
    }

    const paper = dilate(bright, width, height, 3);
    const outside = exterior(paper, width, height);
    const points: Point[] = [];
    let area = 0;
    const edgeShare = [0, 0, 0, 0];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;

            if (paper[index] === 0 || outside[index] === 1) {
                continue;
            }

            area += 1;

            if (y === 0) {
                edgeShare[0] += 1;
            }

            if (x === width - 1) {
                edgeShare[1] += 1;
            }

            if (y === height - 1) {
                edgeShare[2] += 1;
            }

            if (x === 0) {
                edgeShare[3] += 1;
            }

            const neighborOutside = (x > 0 && outside[index - 1] === 1)
                || (x < width - 1 && outside[index + 1] === 1)
                || (y > 0 && outside[index - width] === 1)
                || (y < height - 1 && outside[index + width] === 1);

            if (neighborOutside && (x + y) % 2 === 0) {
                points.push({ x, y });
            }
        }
    }

    const touchedEdges = edgeShare.filter((count, index) => count > (index % 2 === 0 ? width : height) * 0.45).length;

    if (touchedEdges >= 3 || area < width * height * 0.08 || points.length < 12) {
        return null;
    }

    const corners = fourCorners(convexHull(points));

    if (!corners) {
        return null;
    }

    const shape = quadArea(corners);

    if (shape < width * height * 0.08) {
        return null;
    }

    const framed = insideGuide(corners, guide) && shape >= guide.width * guide.height * 0.28;

    return { corners, framed };
}

function solveLinear(matrix: number[][], values: number[]) {
    const size = values.length;
    const rows = matrix.map((row, index) => [...row, values[index]]);

    for (let column = 0; column < size; column++) {
        let pivot = column;

        for (let row = column + 1; row < size; row++) {
            if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) {
                pivot = row;
            }
        }

        if (Math.abs(rows[pivot][column]) < 1e-8) {
            return null;
        }

        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];

        for (let cell = column; cell <= size; cell++) {
            rows[column][cell] /= divisor;
        }

        for (let row = 0; row < size; row++) {
            if (row === column) {
                continue;
            }

            const factor = rows[row][column];

            for (let cell = column; cell <= size; cell++) {
                rows[row][cell] -= factor * rows[column][cell];
            }
        }
    }

    return rows.map((row) => row[size]);
}

function project(homography: number[], x: number, y: number) {
    const denominator = homography[6] * x + homography[7] * y + 1;

    return {
        x: (homography[0] * x + homography[1] * y + homography[2]) / denominator,
        y: (homography[3] * x + homography[4] * y + homography[5]) / denominator,
    };
}

function sample(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
    if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
        return [255, 255, 255];
    }

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const dx = x - x0;
    const dy = y - y0;
    const read = (px: number, py: number) => {
        const index = (py * width + px) * 4;

        return [data[index], data[index + 1], data[index + 2]];
    };
    const topLeft = read(x0, y0);
    const topRight = read(x0 + 1, y0);
    const bottomLeft = read(x0, y0 + 1);
    const bottomRight = read(x0 + 1, y0 + 1);

    return [0, 1, 2].map((channel) =>
        Math.round(
            topLeft[channel] * (1 - dx) * (1 - dy)
            + topRight[channel] * dx * (1 - dy)
            + bottomLeft[channel] * (1 - dx) * dy
            + bottomRight[channel] * dx * dy,
        ),
    );
}

export function warpReceipt(image: Raster, corners: [Point, Point, Point, Point]) {
    const distance = (start: Point, end: Point) => Math.hypot(end.x - start.x, end.y - start.y);
    let width = Math.max(distance(corners[0], corners[1]), distance(corners[3], corners[2]));
    let height = Math.max(distance(corners[0], corners[3]), distance(corners[1], corners[2]));
    const longest = Math.max(width, height);

    if (longest < 8) {
        return null;
    }

    const fit = Math.min(1, 2000 / longest);
    width = Math.max(1, Math.round(width * fit));
    height = Math.max(1, Math.round(height * fit));
    const destination = [
        { x: 0, y: 0 },
        { x: width - 1, y: 0 },
        { x: width - 1, y: height - 1 },
        { x: 0, y: height - 1 },
    ];
    const equations: number[][] = [];
    const values: number[] = [];

    destination.forEach((point, index) => {
        const source = corners[index];
        equations.push([point.x, point.y, 1, 0, 0, 0, -source.x * point.x, -source.x * point.y]);
        values.push(source.x);
        equations.push([0, 0, 0, point.x, point.y, 1, -source.y * point.x, -source.y * point.y]);
        values.push(source.y);
    });

    const homography = solveLinear(equations, values);

    if (!homography) {
        return null;
    }

    const output = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const source = project(homography, x, y);
            const color = sample(image.data, image.width, image.height, source.x, source.y);
            const index = (y * width + x) * 4;
            output[index] = color[0];
            output[index + 1] = color[1];
            output[index + 2] = color[2];
            output[index + 3] = 255;
        }
    }

    return { data: output, width, height };
}

export function cornersMatch(current: Point[], previous: Point[], tolerance: number) {
    return current.every((point, index) => Math.hypot(point.x - previous[index].x, point.y - previous[index].y) <= tolerance);
}
