import os
from datetime import datetime
import onnxruntime as ort


def _ts():
    return datetime.now().strftime('[%m/%d/%Y-%H:%M:%S]')


def createORTSession(model_path: str, device_id: int = 0):
    """Create an ONNX Runtime inference session with optimized provider selection."""
    filename = os.path.basename(model_path)
    print(f'{_ts()} [ORT] Loading ONNX model from path {model_path}...')

    available_providers = ort.get_available_providers()
    providers = []
    provider_options = []

    # 1. DirectML (Best for most Windows GPUs)
    if 'DmlExecutionProvider' in available_providers:
        providers.append('DmlExecutionProvider')
        provider_options.append({'device_id': device_id, "execution_mode": "parallel", "arena_extend_strategy": "kSameAsRequested"})

    # 2. OpenVINO (Great for Intel NPUs and CPUs)
    if 'OpenVINOExecutionProvider' in available_providers:
        providers.append('OpenVINOExecutionProvider')
        # Attempt to use NPU if available, otherwise fallback to CPU
        provider_options.append({'device_type': 'NPU_FP16'}) # Default to NPU for performance

    # 3. CUDA (For Nvidia GPUs if not using TensorRT)
    if 'CUDAExecutionProvider' in available_providers:
        providers.append('CUDAExecutionProvider')
        provider_options.append({'device_id': device_id})

    # Always include CPU fallback
    providers.append('CPUExecutionProvider')
    provider_options.append({})

    options = ort.SessionOptions()
    options.enable_mem_pattern = True
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.enable_cpu_mem_arena = True

    try:
        session = ort.InferenceSession(model_path, sess_options=options, providers=providers, provider_options=provider_options)
    except Exception as e:
        print(f'{_ts()} [ORT] Warning: Failed to load with preferred providers. Error: {e}')
        print(f'{_ts()} [ORT] Falling back to CPU...')
        session = ort.InferenceSession(model_path, sess_options=options, providers=['CPUExecutionProvider'])

    print(f'{_ts()} [ORT] Completed loading session: {filename}')
    print(f'{_ts()} [ORT] Active provider: {session.get_providers()[0]}')
    return session