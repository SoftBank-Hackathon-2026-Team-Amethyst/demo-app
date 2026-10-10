-- demo-app initial schema

CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    option_key VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guestbook (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial vote options
INSERT INTO votes (option_key, title, count)
VALUES 
    ('rolling', '무중단 롤링 배포 (Rolling Update)', 5),
    ('blue_green', '블루-그린 배포 (Blue/Green)', 8),
    ('canary', '카나리 배포 (Canary Deployment)', 12)
ON CONFLICT (option_key) DO NOTHING;

-- Seed initial guestbook messages (배포마다 실행되므로 테이블이 비어 있을 때만 넣는다)
INSERT INTO guestbook (name, message)
SELECT v.name, v.message
FROM (VALUES
    ('DevOps 엔지니어', '원터치 배포 플랫폼 v1 배포 성공을 축하합니다! 🎉'),
    ('플랫폼 팀', '무중단 배포 및 롤백 테스트 대기 중입니다.')
) AS v(name, message)
WHERE NOT EXISTS (SELECT 1 FROM guestbook);

SELECT 1/0 AS t12_intentional_failure;
