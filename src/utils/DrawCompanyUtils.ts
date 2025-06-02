import { ICompany } from "../DrawStampTypes" // 确保你的路径正确

export class DrawCompanyUtils {
    private mmToPixel = 10
    // 添加存储文字路径的数组
    private textPaths: Array<{
        text: string,
        path: Path2D,
        type: 'company',
        bounds: {
            x: number,
            y: number,
            width: number,
            height: number
        }
    }> = []

    constructor(mmToPixel: number) {
        this.mmToPixel = mmToPixel
        this.textPaths = []
    }

    // 添加获取文字路径的方法
    getTextPaths() {
        return this.textPaths
    }

    // 清除文字路径
    clearTextPaths() {
        this.textPaths = []
    }

    // 添加绘制公司列表的方法
    drawCompanyList(
        ctx: CanvasRenderingContext2D,
        companyList: ICompany[],
        centerX: number,
        centerY: number,
        radiusX: number,
        radiusY: number,
        color: string
    ) {
        companyList.forEach((company) => {
            this.drawCompanyName(ctx, company, centerX, centerY, radiusX, radiusY, company.color || color)
        })
    }

    /**
     * 绘制公司名称（优化版）
     * @param ctx Canvas 2D 上下文
     * @param company 公司配置对象
     * @param centerX 圆心x坐标
     * @param centerY 圆心y坐标
     * @param radiusX 椭圆外圈长轴半径
     * @param radiusY 椭圆外圈短轴半径
     * @param color 文本颜色
     */
    drawCompanyName(
        ctx: CanvasRenderingContext2D,
        company: ICompany,
        centerX: number,
        centerY: number,
        radiusX: number,
        radiusY: number,
        color: string
    ) {
        const companyName = company.companyName || "";
        if (!companyName.length) {
            return;
        }

        const fontSize = company.fontHeight * this.mmToPixel;
        const fontWeight = company.fontWeight || 'normal';
        ctx.save();
        ctx.font = `${fontWeight} ${fontSize}px ${company.fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // 重要：让字符在其坐标点上垂直居中

        const characters = companyName.split('');
        const characterCount = characters.length;
        const borderOffset = company.borderOffset * this.mmToPixel;

        // 计算文字中心线所在的有效半径
        const actualNominalRadiusX = radiusX - borderOffset - (fontSize / 2);
        const actualNominalRadiusY = radiusY - borderOffset - (fontSize / 2);

        // 当前的 totalAngle 计算公式
        const currentTextDistributionFactor = company.textDistributionFactor;
        // --- 修改点：将原公式中的常数 4 修改为 12 ---
        // 这会使得当 TDF 较小时 (如1.0)，totalAngle 不会过大，从而使字间距更合理
        const totalAngle = Math.PI * (0.5 + characterCount / (currentTextDistributionFactor * 12));
        
        const anglePerChar = totalAngle / characterCount;

        // 1. 获取配置的或默认的文本弧中心点
        let configuredArcCenterAngle = (company.startAngle !== undefined)
            ? (company.startAngle * Math.PI / 180)
            : -Math.PI / 2; // 默认为顶部

        const effectiveDirection = company.rotateDirection === 'clockwise' ? 1 : -1;

        // 2. 补偿逻辑：针对 totalAngle 公式中的 "0.5 * PI" 部分带来的固定偏移
        // 这个补偿使得文字块能正确地围绕 configuredArcCenterAngle 对称分布
        const compensatedArcCenterAngle = configuredArcCenterAngle + (effectiveDirection * 0.25 * Math.PI);
        
        // 使用补偿后的中心角进行后续计算
        const effectiveArcCenterAngle = compensatedArcCenterAngle;


        let firstCharCenterAngle;
        if (characterCount > 1) {
            firstCharCenterAngle = effectiveArcCenterAngle - (effectiveDirection * totalAngle / 2) + (effectiveDirection * anglePerChar / 2);
        } else {
            // 如果只有一个字符，直接放在中心点
            firstCharCenterAngle = effectiveArcCenterAngle;
        }

        // --- 开始绘制每个字符 ---
        if (company.adjustEllipseText && characterCount > 1) {
            // 当需要为椭圆调整文字间距时的逻辑
            characters.forEach((char, index) => {
                let currentCharacterAngle = firstCharCenterAngle + (effectiveDirection * anglePerChar * index);

                const indexFromCenter = index - (characterCount - 1) / 2.0;
                const adjustmentFactorBase = Math.abs(indexFromCenter) / ((characterCount - 1) / 2.0);
                const adjustmentAmount = Math.pow(adjustmentFactorBase, 2) * anglePerChar * (company.adjustEllipseTextFactor || 0);
                
                if (indexFromCenter < 0) {
                    currentCharacterAngle -= adjustmentAmount * effectiveDirection;
                } else if (indexFromCenter > 0) {
                    currentCharacterAngle += adjustmentAmount * effectiveDirection;
                }

                const x = centerX + Math.cos(currentCharacterAngle) * actualNominalRadiusX;
                const y = centerY + Math.sin(currentCharacterAngle) * actualNominalRadiusY;

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(currentCharacterAngle + Math.PI / 2); // 旋转字符使其垂直于半径
                ctx.scale(company.compression, 1);

                ctx.fillText(char, 0, 0);
                ctx.restore();
            });

        } else {
            // 不调整椭圆文字时的标准绘制逻辑
            characters.forEach((char, index) => {
                const angle = firstCharCenterAngle + (effectiveDirection * anglePerChar * index);
                
                const x = centerX + Math.cos(angle) * actualNominalRadiusX;
                const y = centerY + Math.sin(angle) * actualNominalRadiusY;
        
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle + Math.PI / 2); // 旋转字符使其垂直于半径
                ctx.scale(company.compression, 1);

                // (可选) 创建文字路径（用于点击检测等）
                const path = new Path2D();
                path.rect(-fontSize/2, -fontSize/2, fontSize * company.compression, fontSize);
                this.textPaths.push({
                    text: char,
                    path: path,
                    type: 'company',
                    bounds: {
                        x: x - (fontSize * company.compression) / 2,
                        y: y - fontSize / 2,
                        width: fontSize * company.compression,
                        height: fontSize
                    }
                });

                ctx.fillText(char, 0, 0);
                ctx.restore();
            });
        }
      
        ctx.restore();
    }
}
