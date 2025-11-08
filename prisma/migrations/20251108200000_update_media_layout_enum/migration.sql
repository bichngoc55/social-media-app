-- AlterEnum
-- Xóa các giá trị cũ và thêm giá trị mới
ALTER TYPE "MediaLayout" RENAME TO "MediaLayout_old";

CREATE TYPE "MediaLayout" AS ENUM ('GRID', 'CAROUSEL', 'COLUMNS', 'FRAME');

-- Update existing data: chuyển SINGLE, STACK, MASONRY về GRID
ALTER TABLE "posts" ALTER COLUMN "mediaLayout" TYPE "MediaLayout" USING (
  CASE 
    WHEN "mediaLayout"::text = 'SINGLE' THEN 'GRID'::"MediaLayout"
    WHEN "mediaLayout"::text = 'STACK' THEN 'GRID'::"MediaLayout"
    WHEN "mediaLayout"::text = 'MASONRY' THEN 'GRID'::"MediaLayout"
    WHEN "mediaLayout"::text = 'GRID' THEN 'GRID'::"MediaLayout"
    WHEN "mediaLayout"::text = 'CAROUSEL' THEN 'CAROUSEL'::"MediaLayout"
    ELSE NULL
  END
);

-- Drop old enum
DROP TYPE "MediaLayout_old";

