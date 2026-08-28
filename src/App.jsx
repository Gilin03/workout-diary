import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

const CURRENT_SCHEMA_VERSION = 2;

const emptyForm = {
  workout_date: "",
  pushup_1: "",
  pushup_2: "",
  pushup_3: "",
  squat_1: "",
  squat_2: "",
  squat_3: "",
  legraise_1: "",
  legraise_2: "",
  legraise_3: "",
  intensity: "보통",
};

function App() {
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [migrationMessage, setMigrationMessage] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("workout_records")
      .select("*")
      .order("workout_date", { ascending: false });

    if (error) {
      setError(`기록을 불러오지 못했습니다: ${error.message}`);
      setLoading(false);
      return;
    }

    let loadedRecords = data || [];

    // V1 → V2 자동 변환
    const v1Records = loadedRecords.filter(
      (record) => (record.schema_version ?? 1) === 1,
    );

    if (v1Records.length > 0) {
      const v2Records = v1Records.map((record) => ({
        ...record,
        intensity: record.intensity || "보통",
        schema_version: CURRENT_SCHEMA_VERSION,
      }));

      const { error: migrationError } = await supabase
        .from("workout_records")
        .upsert(v2Records, {
          onConflict: "id",
        });

      if (migrationError) {
        setError(`V1 → V2 변환에 실패했습니다: ${migrationError.message}`);
        setLoading(false);
        return;
      }

      setMigrationMessage(
        `V1 → V2 변환 완료 · 기존 기록 ${v1Records.length}건 보존`,
      );

      // 변환된 데이터를 화면에도 즉시 반영
      loadedRecords = loadedRecords.map((record) => {
        if ((record.schema_version ?? 1) === 1) {
          return {
            ...record,
            intensity: record.intensity || "보통",
            schema_version: CURRENT_SCHEMA_VERSION,
          };
        }

        return record;
      });
    }

    setRecords(loadedRecords);
    setLoading(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  function openAddForm() {
    setMessage("");
    setError("");
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const requiredFields = Object.keys(emptyForm);

    const hasEmptyField = requiredFields.some((field) => form[field] === "");

    if (hasEmptyField) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

   const numericFields = requiredFields.filter(
  (field) => !["workout_date", "intensity"].includes(field),
);

    const hasInvalidNumber = numericFields.some(
      (field) =>
        !Number.isInteger(Number(form[field])) || Number(form[field]) < 0,
    );

    if (hasInvalidNumber) {
      setError("운동 횟수는 0 이상의 정수만 입력해주세요.");
      return;
    }

    const recordData = {
      workout_date: form.workout_date,
      pushup_1: Number(form.pushup_1),
      pushup_2: Number(form.pushup_2),
      pushup_3: Number(form.pushup_3),
      squat_1: Number(form.squat_1),
      squat_2: Number(form.squat_2),
      squat_3: Number(form.squat_3),
      legraise_1: Number(form.legraise_1),
      legraise_2: Number(form.legraise_2),
      legraise_3: Number(form.legraise_3),
      intensity: form.intensity,
      schema_version: CURRENT_SCHEMA_VERSION,
    };

    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from("workout_records")
        .update(recordData)
        .eq("id", editingId);

      if (error) {
        setError(`수정에 실패했습니다: ${error.message}`);
      } else {
        setMessage("기록을 수정했습니다.");
        resetForm();
        await loadRecords();
      }
    } else {
      const { error } = await supabase
        .from("workout_records")
        .insert(recordData);

      if (error) {
        setError(`기록 추가에 실패했습니다: ${error.message}`);
      } else {
        setMessage("새 기록을 추가했습니다.");
        resetForm();
        await loadRecords();
      }
    }

    setSaving(false);
  }

  function startEdit(record) {
    setEditingId(record.id);

    setForm({
      workout_date: record.workout_date,
      pushup_1: String(record.pushup_1),
      pushup_2: String(record.pushup_2),
      pushup_3: String(record.pushup_3),
      squat_1: String(record.squat_1),
      squat_2: String(record.squat_2),
      squat_3: String(record.squat_3),
      legraise_1: String(record.legraise_1),
      legraise_2: String(record.legraise_2),
      legraise_3: String(record.legraise_3),
      intensity: record.intensity || "보통",
    });

    setMessage("");
    setError("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteRecord(id) {
    const confirmed = window.confirm("이 운동 기록을 삭제하시겠습니까?");

    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error } = await supabase
      .from("workout_records")
      .delete()
      .eq("id", id);

    if (error) {
      setError(`삭제에 실패했습니다: ${error.message}`);
    } else {
      setMessage("기록을 삭제했습니다.");
      await loadRecords();
    }
  }

  async function deleteAllRecords() {
    const confirmed = window.confirm(
      "모든 운동 기록을 삭제하시겠습니까?\n삭제한 기록은 복원할 수 없습니다.",
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    const { error } = await supabase
      .from("workout_records")
      .delete()
      .not("id", "is", null);

    if (error) {
      setError(`전체 삭제에 실패했습니다: ${error.message}`);
      return;
    }

    setMessage("전체 기록을 삭제했습니다.");
    await loadRecords();
  }

  function exportJSON() {
    if (records.length === 0) {
      setError("내보낼 기록이 없습니다.");
      return;
    }

    const backup = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      records,
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "workout-diary-v1.json";
    link.click();

    URL.revokeObjectURL(url);

    setError("");
    setMessage(`${records.length}건을 JSON으로 내보냈습니다.`);
  }

  async function importJSON(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("");
    setError("");

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (
        !backup ||
        typeof backup !== "object" ||
        !Array.isArray(backup.records)
      ) {
        throw new Error("올바른 운동 기록 백업 파일이 아닙니다.");
      }

      if (backup.schemaVersion !== 1) {
        throw new Error(
          `지원하지 않는 데이터 형식입니다. 현재 버전: ${backup.schemaVersion}`,
        );
      }

      const requiredFields = [
        "id",
        "workout_date",
        "pushup_1",
        "pushup_2",
        "pushup_3",
        "squat_1",
        "squat_2",
        "squat_3",
        "legraise_1",
        "legraise_2",
        "legraise_3",
        "schema_version",
      ];

      for (const record of backup.records) {
        for (const field of requiredFields) {
          if (!(field in record)) {
            throw new Error(`필수 항목이 없습니다: ${field}`);
          }
        }

        const numberFields = requiredFields.filter(
          (field) => !["id", "workout_date"].includes(field),
        );

        for (const field of numberFields) {
          if (!Number.isInteger(record[field]) || record[field] < 0) {
            throw new Error(`잘못된 값이 있습니다: ${field}`);
          }
        }

        if (
          typeof record.workout_date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(record.workout_date)
        ) {
          throw new Error(`잘못된 날짜 형식입니다: ${record.workout_date}`);
        }
      }

      const recordsToInsert = backup.records.map((record) => ({
        id: record.id,
        workout_date: record.workout_date,
        pushup_1: record.pushup_1,
        pushup_2: record.pushup_2,
        pushup_3: record.pushup_3,
        squat_1: record.squat_1,
        squat_2: record.squat_2,
        squat_3: record.squat_3,
        legraise_1: record.legraise_1,
        legraise_2: record.legraise_2,
        legraise_3: record.legraise_3,
        schema_version: 1,
        created_at: record.created_at || new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("workout_records")
        .upsert(recordsToInsert, {
          onConflict: "id",
        });

      if (error) {
        throw new Error(`데이터 복원에 실패했습니다: ${error.message}`);
      }

      await loadRecords();

      setMessage(`${recordsToInsert.length}건을 성공적으로 가져왔습니다.`);
    } catch (error) {
      console.error(error);

      setError(
        `가져오기 실패: ${error.message} 기존 기록은 변경되지 않았습니다.`,
      );
    } finally {
      event.target.value = "";
    }
  }

  const weeklySummary = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;

    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weeklyRecords = records.filter((record) => {
      const date = new Date(`${record.workout_date}T00:00:00`);

      return date >= monday && date <= sunday;
    });

    const uniqueDays = new Set(
      weeklyRecords.map((record) => record.workout_date),
    ).size;

    return {
      days: uniqueDays,

      pushup: weeklyRecords.reduce(
        (sum, record) =>
          sum + record.pushup_1 + record.pushup_2 + record.pushup_3,
        0,
      ),

      squat: weeklyRecords.reduce(
        (sum, record) => sum + record.squat_1 + record.squat_2 + record.squat_3,
        0,
      ),

      legraise: weeklyRecords.reduce(
        (sum, record) =>
          sum + record.legraise_1 + record.legraise_2 + record.legraise_3,
        0,
      ),
    };
  }, [records]);

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">W</div>

          <div>
            <p className="brand-name">WORKOUT DIARY</p>
            <span>맨몸운동 기록</span>
          </div>
        </div>

        <div className="version-badge">
          데이터 형식 <strong>v2</strong>
        </div>

        {migrationMessage && (
          <div className="migration-badge">{migrationMessage}</div>
        )}
      </header>

      <section className="intro">
        <div>
          <p className="section-label">MY TRAINING LOG</p>
          <h1>오늘보다 조금 더 강하게.</h1>
          <p>운동 기록을 남기고, 변화를 확인하세요.</p>
        </div>

        <button className="add-button" type="button" onClick={openAddForm}>
          <span>＋</span>
          기록 추가
        </button>
      </section>

      <section className="summary-section">
        <div className="section-title">
          <div>
            <p className="section-label">THIS WEEK</p>
            <h2>이번 주 요약</h2>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card primary">
            <span>운동일</span>
            <strong>{weeklySummary.days}</strong>
            <small>일</small>
          </div>

          <div className="summary-card">
            <span>팔굽혀펴기</span>
            <strong>{weeklySummary.pushup}</strong>
            <small>회</small>
          </div>

          <div className="summary-card">
            <span>스쿼트</span>
            <strong>{weeklySummary.squat}</strong>
            <small>회</small>
          </div>

          <div className="summary-card">
            <span>레그레이즈</span>
            <strong>{weeklySummary.legraise}</strong>
            <small>회</small>
          </div>
        </div>
      </section>

      {showForm && (
        <section className="form-panel">
          <div className="form-panel-header">
            <div>
              <p className="section-label">
                {editingId ? "EDIT RECORD" : "NEW RECORD"}
              </p>

              <h2>{editingId ? "운동 기록 수정" : "새 운동 기록"}</h2>
            </div>

            <button className="close-button" type="button" onClick={resetForm}>
              닫기
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="date-input">
              <span>운동 날짜</span>

              <input
                type="date"
                name="workout_date"
                value={form.workout_date}
                onChange={handleChange}
              />
            </label>

            <label className="intensity-input">
              <span>운동 강도</span>

              <select
                name="intensity"
                value={form.intensity}
                onChange={handleChange}
              >
                <option value="쉬움">쉬움</option>
                <option value="보통">보통</option>
                <option value="어려움">어려움</option>
              </select>
            </label>

            <div className="exercise-inputs">
              <ExerciseInput
                title="팔굽혀펴기"
                prefix="pushup"
                form={form}
                onChange={handleChange}
              />

              <ExerciseInput
                title="스쿼트"
                prefix="squat"
                form={form}
                onChange={handleChange}
              />

              <ExerciseInput
                title="레그레이즈"
                prefix="legraise"
                form={form}
                onChange={handleChange}
              />
            </div>

            <div className="form-footer">
              <span>단위: 회</span>

              <div>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={resetForm}
                >
                  취소
                </button>

                <button type="submit" className="save-button" disabled={saving}>
                  {saving
                    ? "저장 중..."
                    : editingId
                      ? "수정 저장"
                      : "기록 저장"}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {(message || error) && (
        <div className={`notice ${error ? "notice-error" : "notice-success"}`}>
          {error || message}
        </div>
      )}

      <section className="records-section">
        <div className="section-title">
          <div>
            <p className="section-label">RECENT RECORDS</p>
            <h2>운동 기록</h2>
          </div>

          <span className="record-count">
            총 <strong>{records.length}</strong>건
          </span>
        </div>

        <div className="records-table">
          <div className="table-header">
            <span>날짜</span>
            <span>입력 시간</span>
            <span>팔굽혀펴기</span>
            <span>스쿼트</span>
            <span>레그레이즈</span>
            <span>강도</span>
            <span>관리</span>
          </div>
          {loading ? (
            <div className="table-empty">기록을 불러오는 중...</div>
          ) : records.length === 0 ? (
            <div className="table-empty">
              <strong>아직 기록이 없습니다.</strong>
              <span>위의 기록 추가 버튼으로 첫 운동을 남겨보세요.</span>
            </div>
          ) : (
            records.map((record) => (
              <div className="table-row" key={record.id}>
                <div className="date-cell">
                  <strong>
                    {record.workout_date.slice(5).replace("-", ".")}
                  </strong>

                  <span>{record.workout_date.slice(0, 4)}</span>
                </div>

                <div className="time-cell">
                  {record.created_at
                    ? new Date(record.created_at).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "-"}
                </div>

                <SetResult
                  a={record.pushup_1}
                  b={record.pushup_2}
                  c={record.pushup_3}
                />

                <SetResult
                  a={record.squat_1}
                  b={record.squat_2}
                  c={record.squat_3}
                />

                <SetResult
                  a={record.legraise_1}
                  b={record.legraise_2}
                  c={record.legraise_3}
                />

                <div className="intensity-cell">
                  <span className={`intensity-badge ${record.intensity}`}>
                    {record.intensity || "보통"}
                  </span>
                </div>

                <div className="row-actions">
                  <button type="button" onClick={() => startEdit(record)}>
                    수정
                  </button>

                  <button type="button" onClick={() => deleteRecord(record.id)}>
                    삭제
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="data-section">
        <div>
          <p className="section-label">DATA MANAGEMENT</p>
          <h2>데이터 관리</h2>
          <p>운동 기록을 JSON 파일로 백업하거나 복원할 수 있습니다.</p>
        </div>

        <div className="data-actions">
          <button type="button" onClick={exportJSON}>
            JSON 내보내기
          </button>

          <button type="button" onClick={() => fileInputRef.current?.click()}>
            JSON 가져오기
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={importJSON}
            hidden
          />

          <button
            type="button"
            className="delete-all-button"
            onClick={deleteAllRecords}
          >
            전체 삭제
          </button>
        </div>
      </section>

      <footer>
        기록 단위: 회&nbsp;&nbsp;·&nbsp;&nbsp;기준 시간대: KST (Asia/Seoul)
      </footer>
    </main>
  );
}

function ExerciseInput({ title, prefix, form, onChange }) {
  return (
    <div className="exercise-input">
      <div className="exercise-input-title">
        <strong>{title}</strong>
        <span>회</span>
      </div>

      <div className="set-inputs">
        {[1, 2, 3].map((set) => (
          <label key={set}>
            <span>{set}세트</span>

            <input
              type="number"
              min="0"
              name={`${prefix}_${set}`}
              value={form[`${prefix}_${set}`]}
              onChange={onChange}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function SetResult({ a, b, c }) {
  const total = a + b + c;

  return (
    <div className="set-result">
      <strong>
        {a} <i>·</i> {b} <i>·</i> {c}
      </strong>

      <span>총 {total}회</span>
    </div>
  );
}

export default App;
